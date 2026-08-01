import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@repo/db';
import { BrainDumpsController } from '../brain-dumps.controller';
import { BrainDumpsService } from '../brain-dumps.service';

describe('BrainDumpsController', () => {
  let controller: BrainDumpsController;

  const mockService = {
    createBrainDump: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrainDumpsController],
      providers: [{ provide: BrainDumpsService, useValue: mockService }],
    }).compile();

    controller = module.get<BrainDumpsController>(BrainDumpsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the current user and the transcript through to the service', async () => {
    const user = { id: 'user_1' } as User;
    const dto = { rawTranscript: 'build a weather app' };
    mockService.createBrainDump.mockResolvedValue({ success: true });

    const result = await controller.createBrainDump(user, dto as any);

    // The user comes from the auth guard, not the body — passing the wrong one
    // would file a brain dump against someone else's account.
    expect(mockService.createBrainDump).toHaveBeenCalledWith(user, dto);
    expect(result).toEqual({ success: true });
  });
});
