import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { MockTokenService } from './mock-token.service';
import { User } from '../../users/entities/user.entity';

describe('MockTokenService', () => {
  let service: MockTokenService;
  let userRepository: Repository<User>;
  let mockEntityManager: Partial<EntityManager>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
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

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockEntityManager = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockTokenService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<MockTokenService>(MockTokenService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('stakeTokens', () => {
    it('should successfully stake tokens when user has sufficient balance', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 10;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });
      (mockEntityManager.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 90,
      });

      const result = await service.stakeTokens(userId, amount);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(90);
      expect(result.message).toBe('Successfully staked 10 tokens');
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(User, {
        where: { id: userId },
      });
      expect(mockEntityManager.save).toHaveBeenCalled();
    });

    it('should fail when user has insufficient tokens', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 150;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });

      const result = await service.stakeTokens(userId, amount);

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Insufficient tokens. Balance: 100, Required: 150',
      );
    });

    it('should fail when user is not found', async () => {
      const userId = 'non-existent-id';
      const amount = 10;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.stakeTokens(userId, amount);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to stake tokens');
    });
  });

  describe('releaseToWinner', () => {
    it('should successfully release tokens to winner', async () => {
      const winnerId = '123e4567-e89b-12d3-a456-426614174000';
      const totalAmount = 20;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 90,
      });
      (mockEntityManager.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 110,
      });

      const result = await service.releaseToWinner(winnerId, totalAmount);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(110);
      expect(result.message).toBe('You won 20 tokens!');
    });

    it('should fail when winner is not found', async () => {
      const winnerId = 'non-existent-id';
      const totalAmount = 20;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.releaseToWinner(winnerId, totalAmount);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to release tokens');
    });
  });

  describe('refundStake', () => {
    it('should successfully refund tokens to user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 10;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 90,
      });
      (mockEntityManager.save as jest.Mock).mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });

      const result = await service.refundStake(userId, amount);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(100);
      expect(result.message).toBe('Wager refunded: 10 tokens');
    });

    it('should fail when user is not found', async () => {
      const userId = 'non-existent-id';
      const amount = 10;

      mockUserRepository.manager.transaction.mockImplementation((callback) =>
        callback(mockEntityManager),
      );
      (mockEntityManager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.refundStake(userId, amount);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to refund tokens');
    });
  });

  describe('getUserBalance', () => {
    it('should return user balance', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });

      const balance = await service.getUserBalance(userId);

      expect(balance).toBe(100);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      const userId = 'non-existent-id';

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserBalance(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hasSufficientTokens', () => {
    it('should return true when user has sufficient tokens', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 50;

      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });

      const result = await service.hasSufficientTokens(userId, amount);

      expect(result).toBe(true);
    });

    it('should return false when user has insufficient tokens', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 150;

      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        mockTokenBalance: 100,
      });

      const result = await service.hasSufficientTokens(userId, amount);

      expect(result).toBe(false);
    });

    it('should return false when user is not found', async () => {
      const userId = 'non-existent-id';
      const amount = 50;

      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.hasSufficientTokens(userId, amount);

      expect(result).toBe(false);
    });
  });
});
