const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const killPort = require('kill-port');
const axios = require('axios');
const { ethers } = require('ethers');

require('dotenv').config();

// USDC token contract on Ethereum mainnet (public, pre-deployed)
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDC_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
];

/**
 * Fetches public state from the USDC smart contract on Ethereum mainnet.
 * Replace "Admin" with your name per assessment instructions.
 */
const AdminApiTest = async (req, res) => {
    try {
        const rpcUrl = process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

        const [name, symbol, decimals, totalSupply] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
            contract.totalSupply(),
        ]);

        const data = {
            contract: USDC_ADDRESS,
            network: 'ethereum-mainnet',
            name,
            symbol,
            decimals: Number(decimals),
            totalSupply: ethers.formatUnits(totalSupply, decimals),
        };

        res.json({ success: true, data });
    } catch (error) {
        console.error('AdminApiTest error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

const checkPort = async (port, maxPort = 65535) => {

    if (port > maxPort) {
        throw new Error("No available ports found");
    }

    try {
        await killPort(port, "tcp");
        await killPort(port, "udp");
        return port;
    } catch (err) {
        return checkPort(port + 1, maxPort);
    }
};

(async () => {
    const safePort = await checkPort(PORT);
    const getPort = (await import('get-port')).default; // dynamic import
    const final_port = await getPort({ port: safePort });

    console.log(`Port ${final_port} is free. Ready to start server.`);

    // Middleware
    app.use(cors({ origin: `http://localhost:${final_port}` }));
    app.use(express.json());
    app.use(morgan('dev'));

    // Routes
    app.use('/api/items', require('./routes/items'));
    app.use('/api/stats', require('./routes/stats'));

    /**
     * @route    GET /api/AdminApiTest
     * @desc     Reads public state (name, symbol, decimals, totalSupply) from USDC on Ethereum mainnet
     * @author   Admin
     * @access   public
     * @returns  {JSON} { success, data: { contract, network, name, symbol, decimals, totalSupply } }
     * @throws   500 on RPC or contract read failure
     *
     * @example
     * curl http://localhost:3001/api/AdminApiTest
     */
    app.get('/api/AdminApiTest', AdminApiTest);

    require('./config/dbHandler.js').connect();

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static('client/build'));
        app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
        });
    }

    // Start server and demonstrate contract fetch via the API endpoint
    app.listen(final_port, async () => {
        console.log(`Backend running on http://localhost:${final_port}`);

        try {
            const { data } = await axios.get(`http://localhost:${final_port}/api/AdminApiTest`);
            console.log('Smart contract data fetched successfully:');
            console.log(JSON.stringify(data, null, 2));
        } catch (error) {
            const message = error.response?.data?.error || error.message;
            console.error('Failed to fetch smart contract data:', message);
        }
    });
})();