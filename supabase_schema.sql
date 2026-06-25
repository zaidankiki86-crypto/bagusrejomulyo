-- SITernak Bagus Rejo Mulyo
-- Supabase PostgreSQL Table Schema (DDL)
-- Paste this script directly inside the Supabase SQL Editor and execute.

-- Disable foreign key checks temporarily to drop tables in correct order (optional)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS harga_domba_harian CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS health_logs CASCADE;
DROP TABLE IF EXISTS growth_logs CASCADE;
DROP TABLE IF EXISTS livestock CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- 1. Members Table
CREATE TABLE members (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

-- 3. Livestock Table
CREATE TABLE livestock (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(50),
    breed VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    dob VARCHAR(50) NOT NULL
);

-- 4. Growth Logs Table
CREATE TABLE growth_logs (
    id SERIAL PRIMARY KEY,
    sheep_id VARCHAR(50) NOT NULL,
    age INTEGER NOT NULL,
    weight REAL NOT NULL,
    chest_girth INTEGER NOT NULL,
    height INTEGER NOT NULL,
    length INTEGER NOT NULL,
    CONSTRAINT fk_livestock_growth FOREIGN KEY(sheep_id) REFERENCES livestock(id) ON DELETE CASCADE
);

-- 5. Health Logs Table
CREATE TABLE health_logs (
    id VARCHAR(50) PRIMARY KEY,
    sheep_id VARCHAR(50) NOT NULL,
    date VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    diagnosis VARCHAR(255) NOT NULL,
    treatment VARCHAR(255) NOT NULL,
    veterinarian VARCHAR(255) NOT NULL,
    CONSTRAINT fk_livestock_health FOREIGN KEY(sheep_id) REFERENCES livestock(id) ON DELETE CASCADE
);

-- 6. Transactions Table
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    date VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL
);

-- 7. Activities Table
CREATE TABLE activities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    date VARCHAR(50) NOT NULL,
    description TEXT,
    image TEXT
);

-- 8. Daily Sheep Prices Summary Table
CREATE TABLE harga_domba_harian (
    id VARCHAR(50) PRIMARY KEY,
    tanggal VARCHAR(50) NOT NULL UNIQUE,
    harga_jawa INTEGER NOT NULL,
    harga_nasional INTEGER NOT NULL,
    harga_tertinggi INTEGER NOT NULL,
    harga_terendah INTEGER NOT NULL,
    sumber VARCHAR(100) NOT NULL
);

-- Enable row-level security or custom indices if needed (optional)
CREATE INDEX idx_livestock_owner ON livestock(owner_id);
CREATE INDEX idx_growth_sheep ON growth_logs(sheep_id);
CREATE INDEX idx_health_sheep ON health_logs(sheep_id);
CREATE INDEX idx_harga_domba_tanggal ON harga_domba_harian(tanggal);
