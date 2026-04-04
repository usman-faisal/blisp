import { Test, TestingModule } from '@nestjs/testing';
import { BrainDumpsService } from './brain-dumps.service';
import { PrismaService } from 'src/common/services/prisma.service';
import { AiService } from 'src/ai/ai.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES, JOBS } from 'src/common/lib/constants';
import { ProjectStatus } from '@repo/db';

describe('BrainDumpsService', () => {
  let service: BrainDumpsService;
  let prisma: PrismaService;
  let aiService: AiService;
  let incubatorQueue: any;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockPrisma = {
    brainDump: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAiService = {
    generateStructuredData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrainDumpsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
        { provide: getQueueToken(QUEUES.INCUBATOR), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<BrainDumpsService>(BrainDumpsService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);
    incubatorQueue = module.get(getQueueToken(QUEUES.INCUBATOR));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a research job for an INCUBATOR project', async () => {
    const mockUser = { id: 'user-1' } as any;
    const mockDto = { prompt: 'Idea for a new CLI tool' };
    const mockInitialDump = { id: 'dump-1', userId: 'user-1', rawTranscript: mockDto.prompt };

    mockPrisma.brainDump.create.mockResolvedValue(mockInitialDump);
    mockAiService.generateStructuredData.mockResolvedValue({
      title: 'New CLI Tool',
      summary: 'A cool CLI tool',
      classification: 'PROJECT',
      suggestedStatus: ProjectStatus.INCUBATOR,
      techStack: ['Node.js'],
    });

    mockPrisma.brainDump.update.mockResolvedValue({
      id: 'dump-1',
      projects: [
        {
          id: 'project-1',
          status: ProjectStatus.INCUBATOR,
          title: 'New CLI Tool',
          description: 'A cool CLI tool',
          techStack: ['Node.js'],
        },
      ],
    });

    await service.createBrainDump(mockUser, mockDto);

    expect(incubatorQueue.add).toHaveBeenCalledWith(JOBS.RESEARCH, expect.objectContaining({
      projectId: 'project-1',
      title: 'New CLI Tool',
    }));
  });
});
