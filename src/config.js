// import * as dotenv from 'dotenv';
// dotenv.config();

class Config {

    get logLevel() {
        return "debug";
    }

    get timeoutLength() {
        return 1000;
    }
};

const config = {
    passwordSaltRounds: 10,
    jwt: {
        secret: process.env.JWT_SECRET,
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER
    },
    port: process.env.PORT || 3000,
    prefix: process.env.API_PREFIX || 'api'
};

module.exports = config;