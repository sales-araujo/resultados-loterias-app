-- ============================================
-- Migration: Criar tabela de jogos (games)
-- ============================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela principal de jogos cadastrados
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_jogo TEXT NOT NULL,
  numeros INTEGER[] NOT NULL,
  trevos INTEGER[],
  concurso_inicio INTEGER NOT NULL,
  concurso_fim INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT games_tipo_jogo_check CHECK (
    tipo_jogo IN (
      'megasena',
      'lotofacil',
      'quina',
      'lotomania',
      'timemania',
      'duplasena',
      'maismilionaria',
      'diadesorte',
      'supersete',
      'loteca'
    )
  ),
  CONSTRAINT games_numeros_not_empty CHECK (array_length(numeros, 1) > 0),
  CONSTRAINT games_concurso_inicio_positive CHECK (concurso_inicio > 0),
  CONSTRAINT games_concurso_fim_check CHECK (
    concurso_fim IS NULL OR concurso_fim >= concurso_inicio
  )
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_games_tipo_jogo ON games(tipo_jogo);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_tipo_jogo_created ON games(tipo_jogo, created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================
-- Para uso público sem autenticação (simplificado)
-- Em produção, adicionar user_id e vincular ao auth.uid()

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Política: permitir leitura pública
CREATE POLICY "Permitir leitura de jogos"
  ON games
  FOR SELECT
  USING (true);

-- Política: permitir inserção pública
CREATE POLICY "Permitir inserção de jogos"
  ON games
  FOR INSERT
  WITH CHECK (true);

-- Política: permitir atualização pública
CREATE POLICY "Permitir atualização de jogos"
  ON games
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Política: permitir exclusão pública
CREATE POLICY "Permitir exclusão de jogos"
  ON games
  FOR DELETE
  USING (true);

-- ============================================
-- Comentários na tabela
-- ============================================
COMMENT ON TABLE games IS 'Jogos de loteria cadastrados pelos usuários';
COMMENT ON COLUMN games.tipo_jogo IS 'Tipo/modalidade do jogo (megasena, lotofacil, etc.)';
COMMENT ON COLUMN games.numeros IS 'Array com os números apostados';
COMMENT ON COLUMN games.trevos IS 'Array com os trevos apostados (apenas +Milionária)';
COMMENT ON COLUMN games.concurso_inicio IS 'Número do concurso inicial da aposta';
COMMENT ON COLUMN games.concurso_fim IS 'Número do concurso final (NULL para concurso único)';
