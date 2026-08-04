// src/controllers/keepAliveController.js

export const ping = (req, res) => {
    // Retorna apenas um 200 OK muito leve
    return res.status(200).json({
        status: 'online',
        message: 'A API está acordada e operante!',
        timestamp: new Date().toISOString()
    });
};