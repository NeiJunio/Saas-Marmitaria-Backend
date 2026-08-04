// src/controllers/keepAliveController.js

// export const ping = (req, res) => {
//     // Retorna apenas um 200 OK muito leve
//     return res.status(200).json({
//         status: 'online',
//         message: 'A API está acordada e operante!',
//         timestamp: new Date().toISOString()
//     });
// };


export const ping = (req, res) => {
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    // 👇 Esse é o print que vai aparecer lá no painel da Render!
    console.log(`[${agora}] 🤖 Bip Bop! Ping recebido do cron-job.org. API acordada!`);

    return res.status(200).json({
        status: 'online',
        message: 'A API está acordada e operante!',
        timestamp: new Date().toISOString()
    });
};