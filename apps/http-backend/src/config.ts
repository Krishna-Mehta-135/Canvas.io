function getJwtSecret(): string {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
    }
    
    return jwtSecret;
}

export const JWT_SECRET: string = getJwtSecret();
