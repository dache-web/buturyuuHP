# Delivery Guide - Profit Finder Pro

This guide explains how to package and deliver the "Profit Finder Pro" dashboard to your client.

## 1. How to Package (ZIP Creation)

To provide the application to your client, please create a ZIP file of the `dashboard_edition` folder **EXCLUDING** the `node_modules` folder.

### What to Include:
- `server.js` (The main engine)
- `analyzer.js` (Analysis logic)
- `constants.js` (Exclusion keywords)
- `logger.js`
- `package.json` (Dependency list)
- `public/` (Entire folder - Website files)
- `User_Manual.md` (Included instruction manual)

### Why exclude `node_modules`?
This folder is very large. It is safer and faster to let the client download these files automatically using the command `npm install` (instructions are in the User Manual).

## 2. Handover Instructions

When you send the ZIP file, please tell your client the following:

> "Please see the attached `User_Manual.md` for installation and operating instructions.
> To run the dashboard, you will need **Node.js** installed on your computer.
> Once installed, you can start the application by running `npm install` and then `node server.js`."

## 3. Maintenance

If you need to update the exclusion keywords (e.g., if new "Used" terms appear), you can edit the `constants.js` file before sending it to the client.
