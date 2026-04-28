import { describe, it, expect } from 'vitest';
import { ApiError } from './ApiError';

describe('ApiError', () => {
    it('should create an instance with status code and message', () => {
        const error = new ApiError(400, 'Bad Request');
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Bad Request');
        expect(error.success).toBe(false);
    });

    it('should include errors array if provided', () => {
        const errors = ['error1', 'error2'];
        const error = new ApiError(400, 'Bad Request', errors);
        expect(error.errors).toEqual(errors);
    });
});
