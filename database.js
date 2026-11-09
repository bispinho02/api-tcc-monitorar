const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho onde o arquivo do banco será salvo na raiz do VS Code
const dbPath = path.resolve(__dirname, 'banco_tcc.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite com sucesso.');
    }
});

db.serialize(() => {
    // 1. USUARIO
    db.run(`
        CREATE TABLE IF NOT EXISTS USUARIO (
            idUsuario TEXT(11) PRIMARY KEY,
            nome TEXT(100) NOT NULL,
            email TEXT(150) NOT NULL UNIQUE,
            senha TEXT(255) NOT NULL,
            perfil TEXT(30) NOT NULL
        )
    `);

    // 2. SENSOR
    db.run(`
        CREATE TABLE IF NOT EXISTS SENSOR (
            idSensor TEXT(11) PRIMARY KEY,
            tipo TEXT(50) NOT NULL,
            localizacao TEXT(100) NOT NULL,
            status TEXT(20) NOT NULL
        )
    `);

    // 3. LEITURA
    db.run(`
        CREATE TABLE IF NOT EXISTS LEITURA (
            idLeitura TEXT(11) PRIMARY KEY,
            temperatura TEXT(5.2),
            umidadeSolo TEXT(5.2),
            dataHora TEXT NOT NULL,
            idSensor TEXT(11),
            idUsuario TEXT(11),
            FOREIGN KEY (idSensor) REFERENCES SENSOR(idSensor),
            FOREIGN KEY (idUsuario) REFERENCES USUARIO(idUsuario)
        )
    `);

    // 4. NOTIFICACAO
    db.run(`
        CREATE TABLE IF NOT EXISTS NOTIFICACAO (
            idNotificacao TEXT(11) PRIMARY KEY,
            mensagem TEXT(255) NOT NULL,
            dataHora TEXT NOT NULL,
            status TEXT(20) NOT NULL,
            idUsuario TEXT(11) NOT NULL,
            idLeitura TEXT NULL,
            FOREIGN KEY (idUsuario) REFERENCES USUARIO(idUsuario),
            FOREIGN KEY (idLeitura) REFERENCES LEITURA(idLeitura)
        )
    `);

    db.run(`ALTER TABLE NOTIFICACAO ADD COLUMN idDispositivo TEXT`, (err) => {
        if (err) {
            // Ignora o erro caso a coluna já exista
        } else {
            console.log("Coluna idDispositivo adicionada com sucesso à tabela NOTIFICACAO!");
        }
    });

    // 5. RELATORIO
    db.run(`
        CREATE TABLE IF NOT EXISTS RELATORIO (
            idRelatorio TEXT(11) PRIMARY KEY,
            dataGeracao TEXT NOT NULL,
            periodoInicio TEXT NOT NULL,
            periodoFim TEXT NOT NULL,
            caminhoPdf TEXT(255) NOT NULL,
            idUsuario TEXT(11) NOT NULL,
            FOREIGN KEY (idUsuario) REFERENCES USUARIO(idUsuario)
        )
    `, (err) => {
        if (err) {
            console.error('Erro ao criar tabelas:', err.message);
        } else {
            console.log('Tabelas verificadas/criadas com sucesso no SQLite!');
        }
    });
});

// Inserção automática do usuário admin de teste
db.serialize(() => {
    const sqlCheck = `SELECT COUNT(*) as total FROM USUARIO WHERE email = 'admin@email.com'`;
    db.get(sqlCheck, [], (err, row) => {
        if (row && row.total === 0) {
            const sqlInsert = `INSERT INTO USUARIO (idUsuario, nome, email, senha, perfil) VALUES (?, ?, ?, ?, ?)`;
            db.run(sqlInsert, ['U001', 'Marcos Silva', 'admin@email.com', '123456', 'Produtor'], (err) => {
                if (!err) console.log('Usuário admin de teste inserido com sucesso!');
            });
        }
    });
});

module.exports = db;