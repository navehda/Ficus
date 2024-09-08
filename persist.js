const fs = require('fs');
const path = require('path');

// File paths
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const cartsFilePath = path.join(__dirname, 'data', 'cart.json');
const activityLogFilePath = path.join(__dirname, 'data', 'activity.json');
const productsFilePath = path.join(__dirname, 'data', 'products.json');

// Helper function for reading files
async function readFile(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error(`Error reading file from ${filePath}:`, err);
        throw err;
    }
}

// Helper function for writing files
async function writeFile(filePath, data) {
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error(`Error writing file to ${filePath}:`, err);
        throw err;
    }
}

// Users persistence
async function getUsers() {
    return await readFile(usersFilePath);
}

async function saveUsers(users) {
    await writeFile(usersFilePath, users);
}

// Cart persistence
async function getCarts() {
    return await readFile(cartsFilePath);
}

async function saveCarts(carts) {
    await writeFile(cartsFilePath, carts);
}

// Activity log persistence
async function logActivity(username, activityType) {
    const activities = await readFile(activityLogFilePath);
    activities.push({
        datetime: new Date().toISOString(),
        username: username,
        type: activityType
    });
    await writeFile(activityLogFilePath, activities);
}

// Retrieve all activities (useful for admin panel)
async function getActivities() {
    return await readFile(activityLogFilePath);
}

// Products persistence
async function getProducts() {
    return await readFile(productsFilePath);
}

async function saveProducts(products) {
    await writeFile(productsFilePath, products);
}

module.exports = {
    getUsers,
    saveUsers,
    getCarts,
    saveCarts,
    logActivity,
    getProducts,
    saveProducts,
    getActivities // Expose activity retrieval for admin purposes
};
