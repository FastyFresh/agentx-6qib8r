import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index 
} from 'typeorm'; // ^0.3.17

/**
 * Enum defining user roles for role-based access control
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AGENT_MANAGER = 'AGENT_MANAGER',
  VIEWER = 'VIEWER'
}

/**
 * User entity representing a system user with comprehensive security features
 * Implements role-based access control and Auth0 integration
 */
@Entity('users')
@Index(['email'], { unique: true })
@Index(['auth0Id'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  auth0Id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.VIEWER
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'integer', default: 0 })
  loginAttempts: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  passwordChangedAt: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  constructor(userData: Partial<User> = {}) {
    // Set default values for security settings
    this.isActive = true;
    this.mfaEnabled = false;
    this.loginAttempts = 0;
    this.preferences = {};
    
    // Merge provided data with defaults
    Object.assign(this, userData);

    // Set timestamps for new instances
    if (!this.createdAt) {
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    // Validate required fields
    if (userData.email && !this.validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    if (!userData.auth0Id) {
      throw new Error('Auth0 ID is required');
    }
  }

  /**
   * Validates email format
   * @param email Email to validate
   * @returns boolean indicating if email is valid
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}