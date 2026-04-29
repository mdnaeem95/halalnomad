import { signInSchema, signUpSchema, addPlaceSchema, reviewSchema } from '../lib/schemas';

describe('signInSchema', () => {
  it('validates correct input', () => {
    const result = signInSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty email', () => {
    const result = signInSchema.safeParse({
      email: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = signInSchema.safeParse({
      email: 'test@example.com',
      password: '12345',
    });
    expect(result.success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('validates correct input', () => {
    const result = signUpSchema.safeParse({
      displayName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty display name', () => {
    const result = signUpSchema.safeParse({
      displayName: '',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects single character display name', () => {
    const result = signUpSchema.safeParse({
      displayName: 'A',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects display name over 30 characters', () => {
    const result = signUpSchema.safeParse({
      displayName: 'A'.repeat(31),
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('addPlaceSchema', () => {
  const validPlace = {
    nameEn: 'Halal Kitchen',
    addressEn: '123 Main Street, City',
    cuisineType: 'middle_eastern' as const,
    priceRange: null,
  };

  it('validates correct input', () => {
    const result = addPlaceSchema.safeParse(validPlace);
    expect(result.success).toBe(true);
  });

  it('validates with optional fields', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      nameLocal: '清真美食',
      addressLocal: '北京市东城区',
      description: 'Great food!',
      hours: 'Mon-Sat 11:00-22:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      nameEn: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty address', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      addressEn: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 characters', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      nameEn: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects description over 500 characters', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      description: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty optional fields', () => {
    const result = addPlaceSchema.safeParse({
      ...validPlace,
      nameLocal: '',
      description: '',
      hours: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('reviewSchema', () => {
  it('validates correct review', () => {
    const result = reviewSchema.safeParse({
      rating: 4,
      text: 'Great Halal food, very authentic!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects rating below 1', () => {
    const result = reviewSchema.safeParse({
      rating: 0,
      text: 'Some review text here',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', () => {
    const result = reviewSchema.safeParse({
      rating: 6,
      text: 'Some review text here',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty text', () => {
    const result = reviewSchema.safeParse({
      rating: 3,
      text: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects text under 10 characters', () => {
    const result = reviewSchema.safeParse({
      rating: 3,
      text: 'Short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects text over 1000 characters', () => {
    const result = reviewSchema.safeParse({
      rating: 3,
      text: 'A'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
