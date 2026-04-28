import { describe, it, expect, vi } from 'vitest';
import { hashPassword, comparePassword } from './password';
import bcrypt from 'bcrypt';

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn(),
    }
}));

describe('password utils', () => {
    it('should hash a password', async () => {
        vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
        const result = await hashPassword('plain');
        expect(result).toBe('hashed');
        expect(bcrypt.hash).toHaveBeenCalledWith('plain', 10);
    });

    it('should compare a password', async () => {
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        const result = await comparePassword('plain', 'hashed');
        expect(result).toBe(true);
        expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
    });
});
