import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WagerService, CreateWagerDto } from './wager.service';
import { Wager, WagerStatus } from '../entities/wager.entity';
import { User } from '../../users/entities/user.entity';
import { TOKEN_SERVICE, ITokenService } from '../interfaces/token.interface';

describe('WagerService', () => {
  let service: WagerService;
  let wagerRepository: Repository<Wager>;
  let userRepository: Repository<User>;
  let tokenService: ITokenService;
  let mockEntityManager: Partial<EntityManager>;

  const mockPlayerA: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'playera@example.com',
    username: 'playera',
    name: 'Player A',
    passwordHash: 'hashedpassword',
    mockTokenBalance: 100,
    xp: 0,
    level: 1,
    levelTitle: 'Gossip Rookie' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'user' as any,
    isActive: true,
    gameSessions: [],
  };

  const mockPlayerB: User = {
    id: '456e7890-e89b-12d3-a456-426614174001',
    email: 'playerb@example.com',
    username: 'playerb',
    name: 'Player B',
    passwordHash: 'hashedpassword',
    mockTokenBalance: 100,
    xp: 0,
    level: 1,
    levelTitle: 'Gossip Rookie' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'user' as any,
    isActive: true,
    gameSessions: [],
  };

  const mockWager: Wager = {
    id: 'wager-123',
    sessionId: 'session-123',
    playerA: mockPlayerA,
    playerAId: mockPlayerA.id,
    playerB: mockPlayerB,
    playerBId: mockPlayerB.id,
    amount: 10,
    totalPot: 20,
    status: WagerStatus.STAKED,
    winner: null as any,
    winnerId: null as any,
    resultMessage: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null as any,
  };

  const mockWagerRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockTokenService = {
    stakeTokens: jest.fn(),
    releaseToWinner: jest.fn(),
    refundStake: jest.fn(),
    getUserBalance: jest.fn(),
    hasSufficientTokens: jest.fn(),
  };

  beforeEach(async () => {
    mockEntityManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WagerService,
        {
          provide: getRepositoryToken(Wager),
          useValue: mockWagerRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    service = module.get<WagerService>(WagerService);
    wagerRepository = module.get<Repository<Wager>>(getRepositoryToken(Wager));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    tokenService = module.get<ITokenService>(TOKEN_SERVICE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWager', () => {
    const createWagerDto: CreateWagerDto = {
      sessionId: 'session-123',
      playerAId: mockPlayerA.id,
      playerBId: mockPlayerB.id,
      amount: 10,
    };

    it('should successfully create a wager', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockPlayerA)
        .mockResolvedValueOnce(mockPlayerB);
      mockTokenService.hasSufficientTokens
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockWagerRepository.findOne.mockResolvedValue(null);
      mockWagerRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      mockTokenService.stakeTokens
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      (mockEntityManager.create as jest.Mock).mockReturnValue(mockWager);
      (mockEntityManager.save as jest.Mock).mockResolvedValue(mockWager);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(true);
      expect(result.wager).toBeDefined();
      expect(result.message).toContain('Wager created');
    });

    it('should fail when player A is not found', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockPlayerB);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Player A with ID');
    });

    it('should fail when player B is not found', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockPlayerA)
        .mockResolvedValueOnce(null);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Player B with ID');
    });

    it('should fail when player A has insufficient tokens', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockPlayerA)
        .mockResolvedValueOnce(mockPlayerB);
      mockTokenService.hasSufficientTokens
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('insufficient tokens');
    });

    it('should fail when player B has insufficient tokens', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockPlayerA)
        .mockResolvedValueOnce(mockPlayerB);
      mockTokenService.hasSufficientTokens
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('insufficient tokens');
    });

    it('should fail when wager already exists for session', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockPlayerA)
        .mockResolvedValueOnce(mockPlayerB);
      mockTokenService.hasSufficientTokens
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockWagerRepository.findOne.mockResolvedValue(mockWager);

      const result = await service.createWager(createWagerDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Wager already exists for this session');
    });
  });

  describe('resolveWagerWithWinner', () => {
    it('should successfully resolve wager with winner', async () => {
      mockWagerRepository.findOne.mockResolvedValue(mockWager);
      mockWagerRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      mockTokenService.releaseToWinner.mockResolvedValue({
        success: true,
        message: 'You won 20 tokens!',
      });
      (mockEntityManager.save as jest.Mock).mockResolvedValue({
        ...mockWager,
        winnerId: mockPlayerA.id,
        winner: mockPlayerA,
        status: WagerStatus.WON,
      });

      const result = await service.resolveWagerWithWinner(
        'session-123',
        mockPlayerA.id,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('You won 20 tokens!');
    });

    it('should fail when wager is not found', async () => {
      mockWagerRepository.findOne.mockResolvedValue(null);

      const result = await service.resolveWagerWithWinner(
        'session-123',
        mockPlayerA.id,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Wager for session');
    });

    it('should fail when wager is already resolved', async () => {
      mockWagerRepository.findOne.mockResolvedValue({
        ...mockWager,
        status: WagerStatus.WON,
      });

      const result = await service.resolveWagerWithWinner(
        'session-123',
        mockPlayerA.id,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already resolved');
    });

    it('should fail when winner is not one of the players', async () => {
      mockWagerRepository.findOne.mockResolvedValue({
        ...mockWager,
        status: WagerStatus.STAKED, // Ensure it's not already resolved
      });

      const result = await service.resolveWagerWithWinner(
        'session-123',
        'invalid-player-id',
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        'Winner must be one of the wagering players',
      );
    });
  });

  describe('resolveWagerAsDraw', () => {
    it('should successfully resolve wager as draw', async () => {
      mockWagerRepository.findOne.mockResolvedValue({
        ...mockWager,
        status: WagerStatus.STAKED, // Ensure it's not already resolved
      });
      mockWagerRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      mockTokenService.refundStake
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      (mockEntityManager.save as jest.Mock).mockResolvedValue({
        ...mockWager,
        status: WagerStatus.REFUNDED,
      });

      const result = await service.resolveWagerAsDraw('session-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Draw!');
    });

    it('should fail when wager is not found', async () => {
      mockWagerRepository.findOne.mockResolvedValue(null);

      const result = await service.resolveWagerAsDraw('session-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Wager for session');
    });

    it('should fail when wager is already resolved', async () => {
      mockWagerRepository.findOne.mockResolvedValue({
        ...mockWager,
        status: WagerStatus.REFUNDED,
      });

      const result = await service.resolveWagerAsDraw('session-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already resolved');
    });
  });

  describe('getWagerBySessionId', () => {
    it('should return wager for session', async () => {
      mockWagerRepository.findOne.mockResolvedValue(mockWager);

      const result = await service.getWagerBySessionId('session-123');

      expect(result).toEqual(mockWager);
      expect(mockWagerRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        relations: ['playerA', 'playerB', 'winner'],
      });
    });

    it('should return null when wager is not found', async () => {
      mockWagerRepository.findOne.mockResolvedValue(null);

      const result = await service.getWagerBySessionId('session-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserWagers', () => {
    it('should return user wagers', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockWager]),
      };

      mockWagerRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserWagers(mockPlayerA.id, 10);

      expect(result).toEqual([mockWager]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'wager.playerAId = :userId OR wager.playerBId = :userId',
        { userId: mockPlayerA.id },
      );
    });

    it('should return empty array on error', async () => {
      mockWagerRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.getUserWagers(mockPlayerA.id, 10);

      expect(result).toEqual([]);
    });
  });
});
