import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.js';
import { databaseOptions } from './database.options.js';

if (existsSync('.env')) loadEnvFile('.env');

export default new DataSource(
  databaseOptions(validateEnvironment(process.env)),
);
