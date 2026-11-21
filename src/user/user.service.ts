import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.trim().toLowerCase() });
  }

  findActiveById(id: number): Promise<User | null> {
    return this.users.findOneBy({ id, isActive: true });
  }
}
