import { Test, TestingModule } from '@nestjs/testing';
import { BrainDumpsController } from './brain-dumps.controller';
import { BrainDumpsService } from './brain-dumps.service';

describe('BrainDumpsController', () => {
  let controller: BrainDumpsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrainDumpsController],
      providers: [BrainDumpsService],
    }).compile();

    controller = module.get<BrainDumpsController>(BrainDumpsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
