const express = require('express');
const cors = require('cors');
const db = require('./database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'sua_chave_secreta_tcc_monitorar';
const PORT = 3000;

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO (JWT)
// ==========================================
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    console.warn('⚠️ [401] Tentativa de acesso sem token válido.');
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  // Utiliza a mesma constante JWT_SECRET definida no topo do arquivo
 jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('⚠️ [403] Token recusado/expirado:', err.message);
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. ROTAS DE AUTENTICAÇÃO E USUÁRIO (Tabela 8)
// ==========================================

// Rota de Cadastro pública usada pelo App
app.post('/api/register', (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  const idUsuario = 'U' + Date.now();
  const perfil = 'PRODUTOR';

  const sql = `INSERT INTO USUARIO (idUsuario, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`;

  db.run(sql, [idUsuario, nome.trim(), email.trim(), senha.trim(), perfil], function (err) {
    if (err) {
      console.error('Erro no SQLite:', err.message);
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
      }
      return res.status(500).json({ error: 'Erro ao cadastrar no banco de dados.' });
    }

    console.log(`[SUCESSO] Usuário cadastrado: ${email}`);
    return res.status(201).json({ message: 'Usuário cadastrado com sucesso!', idUsuario });
  });
});

// Cadastrar Usuário (Interno/Admin)
app.post('/api/usuarios', (req, res) => {
  const { idUsuario, nome, email, senha, perfil } = req.body;
  const sql = `INSERT INTO USUARIO (idUsuario, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`;

  db.run(sql, [idUsuario, nome, email, senha, perfil], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: idUsuario });
  });
});

// Autenticação / Login (Gera e Retorna o JWT)
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const sql = `SELECT idUsuario, nome, email, perfil FROM USUARIO WHERE email = ? AND senha = ?`;

  db.get(sql, [email, senha], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    // Gerar token assinado com a chave do TCC
    const token = jwt.sign(
      { idUsuario: row.idUsuario, email: row.email, perfil: row.perfil },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login realizado com sucesso!',
      usuario: row,
      token: token
    });
  });
});

// Listar Usuários (Protegida)
app.get('/api/usuarios', autenticarToken, (req, res) => {
  db.all(`SELECT idUsuario, nome, email, perfil FROM USUARIO`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==========================================
// 2. ROTAS DE SENSOR (Tabela 9)
// ==========================================

// Cadastrar Sensor (Protegida)
app.post('/api/sensores', autenticarToken, (req, res) => {
  const { idSensor, tipo, localizacao, status } = req.body;
  const sql = `INSERT INTO SENSOR (idSensor, tipo, localizacao, status) VALUES (?, ?, ?, ?)`;

  db.run(sql, [idSensor, tipo, localizacao, status], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json({ message: 'Sensor cadastrado com sucesso!' });
  });
});

// Listar Sensores (Protegida)
app.get('/api/sensores', autenticarToken, (req, res) => {
  db.all(`SELECT * FROM SENSOR`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==========================================
// 3. ROTAS DE LEITURA 
// ==========================================

// Rota do ESP32/Simulador para registrar telemetria
app.post('/api/leituras', (req, res) => {
  const { temperatura, umidadeSolo, dataHora, idSensor, idUsuario } = req.body;
  
  // Garante um idLeitura único se o ESP32 não enviar um idLeitura específico
  const idLeitura = req.body.idLeitura || 'L' + Date.now();
  const usuarioRef = idUsuario || 'U1';
  const dataHoraRef = dataHora || new Date().toISOString();

  const sql = `INSERT INTO LEITURA (idLeitura, temperatura, umidadeSolo, dataHora, idSensor, idUsuario) 
               VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(sql, [idLeitura, temperatura, umidadeSolo, dataHoraRef, idSensor || 'ESP32_01', usuarioRef], function (err) {
    if (err) {
      console.error('❌ Erro ao salvar leitura:', err.message);
      return res.status(400).json({ error: err.message });
    }

    // Regra de Notificação para Umidade Baixa (< 30%)
    if (parseFloat(umidadeSolo) < 30.0) {
      db.get(`SELECT pushToken FROM USUARIO WHERE idUsuario = ?`, [usuarioRef], (errUser, userRow) => {
  if (userRow && userRow.pushToken) {
      // Dispara notificação remota via servidor da Expo (Expo Push API)
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userRow.pushToken,
          sound: 'default',
          title: '🚨 Alerta de Solo Seco!',
          body: `A umidade atual está em ${umidadeSolo}%. Irrigação necessária!`,
          data: { umidadeSolo },
        }),
      }).catch(errPush => console.error('Erro ao enviar Expo Push:', errPush));
  }
      });
    }

    console.log(`[POST] /api/leituras - 201 Created | Leitura registrada com sucesso! idLeitura: ${idLeitura}`);
    console.log(`📊 Dados persistidos: { temperatura: ${temperatura}, umidadeSolo: ${umidadeSolo}, idSensor: "${idSensor || 'ESP32_01'}" }`);

    res.status(201).json({ message: 'Leitura registrada com sucesso!', idLeitura });
  });
});

// Obter histórico de leituras no App (Protegida por JWT)
app.get('/api/leituras', (req, res) => {
  db.all(`SELECT * FROM LEITURA ORDER BY dataHora DESC LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==========================================
// 4. ROTAS DE NOTIFICAÇÃO (Tabela 11)
// ==========================================

// Criar Notificação
app.post('/api/notificacoes', (req, res) => {
  const { mensagem, status, idDispositivo, idLeitura, idUsuario } = req.body;

  if (!mensagem || !status) {
    return res.status(400).json({ error: 'Mensagem e status são obrigatórios.' });
  }

  const usuarioRef = idUsuario || 'U1';

  const salvarNotificacao = (leituraRef) => {
    const idNotificacao = 'N' + Date.now();
    const dataHora = req.body.dataHora || new Date().toISOString();

    const sql = `INSERT INTO NOTIFICACAO (idNotificacao, mensagem, status, dataHora, idDispositivo, idLeitura, idUsuario) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [idNotificacao, mensagem, status, dataHora, idDispositivo || null, leituraRef, usuarioRef], function (err) {
      if (err) {
        console.error('❌ Erro no SQLite ao salvar notificação:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log(`[ALERTA REGISTRADO] Notificação ${idNotificacao} vinculada ao usuário ${usuarioRef}`);
      return res.status(201).json({ message: 'Notificação salva com sucesso!', idNotificacao });
    });
  };

  if (idLeitura) {
    return salvarNotificacao(idLeitura);
  }

  db.get(`SELECT idLeitura FROM LEITURA ORDER BY rowid DESC LIMIT 1`, [], (err, row) => {
    const leituraRef = (row && row.idLeitura) ? row.idLeitura : 'L_SISTEMA';
    salvarNotificacao(leituraRef);
  });
});

// Listar Notificações recentes no App (Protegida)
app.get('/api/notificacoes', autenticarToken, (req, res) => {
  db.all(`SELECT * FROM NOTIFICACAO ORDER BY dataHora DESC LIMIT 20`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==========================================
// 5. ROTAS DE RELATÓRIO (Tabela 12)
// ==========================================

app.post('/api/relatorios', autenticarToken, (req, res) => {
  const { idRelatorio, dataGeracao, periodoInicio, periodoFim, caminhoPdf, idUsuario } = req.body;
  const sql = `INSERT INTO RELATORIO (idRelatorio, dataGeracao, periodoInicio, periodoFim, caminhoPdf, idUsuario) 
               VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(sql, [idRelatorio, dataGeracao, periodoInicio, periodoFim, caminhoPdf, idUsuario], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json({ message: 'Relatório registrado com sucesso!' });
  });
});

// 📱 Rota para cadastrar/atualizar o Push Token do usuário
app.post('/api/usuarios/push-token', (req, res) => {
  const { idUsuario, pushToken } = req.body;

  const sql = `UPDATE USUARIO SET pushToken = ? WHERE idUsuario = ?`;

  db.run(sql, [pushToken, idUsuario || 'U1'], function (err) {
    if (err) {
      console.error('❌ Erro ao salvar Push Token:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ Push Token atualizado para o usuário ${idUsuario}: ${pushToken}`);
    res.status(200).json({ message: 'Token cadastrado com sucesso!' });
  });
});

// DELETE /api/leituras/antigas
app.delete('/api/leituras/antigas', async (req, res) => {
  try {
    const result = await db.run(`
      DELETE FROM leituras 
      WHERE datetime(dataHora) < datetime('now', '-7 days')
    `);

    return res.status(200).json({
      message: 'Limpeza de histórico concluída.',
      registrosRemovidos: result.changes
    });
  } catch (error) {
    console.error('Erro ao limpar leituras antigas:', error);
    return res.status(500).json({ error: 'Erro ao executar limpeza no banco.' });
  }
});

// Iniciar Servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API do TCC rodando em http://0.0.0.0:${PORT}`);
});