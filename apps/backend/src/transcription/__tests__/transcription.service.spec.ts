import {
  BadGatewayException,
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES } from '../transcription.constants';
import { TranscriptionHttpError } from '../transcription.errors';
import { TRANSCRIPTION_PROVIDER, TranscriptionProvider } from '../transcription.provider';
import { TranscriptionService } from '../transcription.service';

/**
 * Upload validation and provider-error mapping.
 *
 * Worth covering because every branch here is a paid request the user is
 * waiting on: a wrong mapping either burns credits on junk audio or shows a
 * dead end instead of a retryable error.
 */
describe('TranscriptionService', () => {
  const USER_ID = 'user-1';

  function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
    return {
      fieldname: 'audio',
      originalname: 'recording.m4a',
      encoding: '7bit',
      mimetype: 'audio/m4a',
      size: MIN_AUDIO_BYTES * 2,
      buffer: Buffer.alloc(MIN_AUDIO_BYTES * 2, 1),
      stream: null as never,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    } as Express.Multer.File;
  }

  async function build(provider: Partial<TranscriptionProvider>): Promise<TranscriptionService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionService,
        {
          provide: TRANSCRIPTION_PROVIDER,
          useValue: {
            name: 'fake',
            isConfigured: () => true,
            transcribe: jest.fn().mockResolvedValue({ text: 'an idea' }),
            ...provider,
          },
        },
      ],
    }).compile();

    return module.get(TranscriptionService);
  }

  describe('upload validation', () => {
    it('rejects a missing file', async () => {
      const service = await build({});
      await expect(service.transcribeAudio(undefined, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty buffer', async () => {
      const service = await build({});
      await expect(service.transcribeAudio(makeFile({ buffer: Buffer.alloc(0) }), USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a recording below the minimum size', async () => {
      const service = await build({});
      await expect(
        service.transcribeAudio(makeFile({ buffer: Buffer.alloc(MIN_AUDIO_BYTES - 1, 1) }), USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a recording above the maximum size', async () => {
      const service = await build({});
      await expect(
        service.transcribeAudio(makeFile({ buffer: Buffer.alloc(MAX_AUDIO_BYTES + 1, 1) }), USER_ID),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects an unsupported format', async () => {
      const service = await build({});
      await expect(
        service.transcribeAudio(makeFile({ mimetype: 'application/pdf', originalname: 'notes.pdf' }), USER_ID),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    // React Native's multipart encoder often sends octet-stream, so the
    // extension alone has to be enough to accept the upload.
    it('accepts octet-stream when the extension is a known audio type', async () => {
      const transcribe = jest.fn().mockResolvedValue({ text: 'hello' });
      const service = await build({ transcribe });

      await expect(
        service.transcribeAudio(makeFile({ mimetype: 'application/octet-stream', originalname: 'dump.m4a' }), USER_ID),
      ).resolves.toEqual({ transcript: 'hello', language: undefined, durationSeconds: undefined });
      expect(transcribe).toHaveBeenCalledTimes(1);
    });

    it('accepts a known mime type even when the filename has no extension', async () => {
      const service = await build({});
      await expect(
        service.transcribeAudio(makeFile({ mimetype: 'audio/mp4; codecs=mp4a', originalname: 'blob' }), USER_ID),
      ).resolves.toMatchObject({ transcript: 'an idea' });
    });
  });

  describe('provider configuration', () => {
    it('returns 503 without calling the provider when it is unconfigured', async () => {
      const transcribe = jest.fn();
      const service = await build({ isConfigured: () => false, transcribe });

      await expect(service.transcribeAudio(makeFile(), USER_ID)).rejects.toThrow(ServiceUnavailableException);
      expect(transcribe).not.toHaveBeenCalled();
    });
  });

  describe('transcription results', () => {
    it('trims the transcript and passes through metadata', async () => {
      const service = await build({
        transcribe: jest.fn().mockResolvedValue({ text: '  build an LMS  ', language: 'en', durationSeconds: 4.2 }),
      });

      await expect(service.transcribeAudio(makeFile(), USER_ID)).resolves.toEqual({
        transcript: 'build an LMS',
        language: 'en',
        durationSeconds: 4.2,
      });
    });

    it('rejects silent audio that transcribes to whitespace', async () => {
      const service = await build({ transcribe: jest.fn().mockResolvedValue({ text: '   ' }) });
      await expect(service.transcribeAudio(makeFile(), USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('forwards the language hint to the provider', async () => {
      const transcribe = jest.fn().mockResolvedValue({ text: 'ok' });
      const service = await build({ transcribe });

      await service.transcribeAudio(makeFile(), USER_ID, 'en');

      expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    });
  });

  describe('provider error mapping', () => {
    it.each([
      [401, ServiceUnavailableException],
      [403, ServiceUnavailableException],
      [429, ServiceUnavailableException],
      [413, PayloadTooLargeException],
      [400, BadRequestException],
      [500, BadGatewayException],
      [502, BadGatewayException],
    ])('maps provider %s onto the right client error', async (status, expected) => {
      const service = await build({
        transcribe: jest.fn().mockRejectedValue(new TranscriptionHttpError(status)),
      });

      await expect(service.transcribeAudio(makeFile(), USER_ID)).rejects.toThrow(expected);
    });

    it('maps an unexpected failure onto 502 without leaking the message', async () => {
      const service = await build({
        transcribe: jest.fn().mockRejectedValue(new Error('Bearer xai-secret-key leaked')),
      });

      await expect(service.transcribeAudio(makeFile(), USER_ID)).rejects.toThrow(/Could not transcribe that recording/);
      await expect(service.transcribeAudio(makeFile(), USER_ID)).rejects.not.toThrow(/xai-secret-key/);
    });
  });
});
