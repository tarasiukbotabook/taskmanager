const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Task Manager</title>
        <meta charset="utf-8">
    </head>
    <body>
        <h1>🎉 Сервер работает!</h1>
        <p>URL: ${req.url}</p>
        <p>Время: ${new Date().toLocaleString('ru-RU')}</p>
        <a href="/tasks">Перейти к задачам</a>
    </body>
    </html>
    `);
});

const PORT = 4000;
server.listen(PORT, '127.0.0.1', () => {
    console.log(`HTTP сервер запущен: http://127.0.0.1:${PORT}`);
    console.log(`Альтернативный URL: http://localhost:${PORT}`);
});

server.on('error', (err) => {
    console.error('Ошибка сервера:', err);
});