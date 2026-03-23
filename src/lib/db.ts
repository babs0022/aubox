// Database schema and model types for Aubox
// This file defines the schema structure for PostgreSQL

export interface User {
  id: string;
  authSubject: string;
  email: string;
  username: string;
  passwordHash: string;
  name?: string;
  profileIcon?: string; // URL to avatar
  createdAt: Date;
  updatedAt: Date;
}

export interface Case {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "active" | "archived" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface Entity {
  id: string;
  caseId: string;
  address: string;
  chain: string;
  label?: string;
  tags?: string[];
  confidence?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationRun {
  id: string;
  caseId: string;
  runType: "profile" | "trace" | "cluster";
  status: "pending" | "running" | "completed" | "failed";
  inputEntities: string[]; // array of entity IDs
  resultId?: string;
  sqsMessageId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface RunResult {
  id: string;
  runId: string;
  resultType: "profile" | "trace" | "cluster";
  data: Record<string, unknown>; // JSON payload
  sourceData: {
    arkham?: boolean;
    explorer?: boolean;
    quicknode?: boolean;
    dexscreener?: boolean;
  };
  createdAt: Date;
}

export interface CaseNote {
  id: string;
  caseId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evidence {
  id: string;
  caseId: string;
  txHash?: string;
  blockNumber?: number;
  chain: string;
  sourceAddress?: string;
  targetAddress?: string;
  value?: string;
  timestamp?: number;
  description?: string;
  createdAt: Date;
}

// SQL schema DDL (paste into your database)
export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  "profileIcon" TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  tags TEXT[],
  confidence FLOAT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(case_id, address, chain)
);

CREATE TABLE IF NOT EXISTS investigation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  run_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  input_entities TEXT[] NOT NULL,
  result_id UUID,
  sqs_message_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES investigation_runs(id) ON DELETE CASCADE,
  result_type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  source_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  tx_hash VARCHAR(255),
  block_number BIGINT,
  chain VARCHAR(50) NOT NULL,
  source_address VARCHAR(255),
  target_address VARCHAR(255),
  value VARCHAR(255),
  timestamp BIGINT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_entities_case_id ON entities(case_id);
CREATE INDEX idx_runs_case_id ON investigation_runs(case_id);
CREATE INDEX idx_runs_status ON investigation_runs(status);
CREATE INDEX idx_results_run_id ON run_results(run_id);
CREATE INDEX idx_notes_case_id ON case_notes(case_id);
CREATE INDEX idx_evidence_case_id ON evidence(case_id);
`;
