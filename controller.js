'use strict';
const config = require('./config');
const https = require('https');
const http = require('http');
const fs = require('fs');

const settingsFile = 'settings.json';

class Controller {

	constructor () {
		this.config = config;
		this.settings = this.#readSettings();
		this.errors = [];
	}

	getSettings () {
		return this.settings;
	}

	getSetting (which, dflt) {
		return which in this.settings ? this.settings[which] : dflt;
	}

	setSettings (values) {
		Object.assign(this.settings, values);
		this.#saveSettings();
	}

	deleteSetting (which) {
		delete this.settings[which];
		this.#saveSettings();
	}

	deleteSettings (which) {
		for (const w of which) {
			delete this.settings[w];
		}
		this.#saveSettings();
	}

	// read a file (sync) or return default data
	readFile (path, dflt) {
		try {
			return fs.readFileSync(path,{encoding:'utf8'});
		} catch (err) {
			console.error(err);
			return dflt;
		}
	}

	// write a file (sync)
	writeFile (path, data) {
		try {
			return fs.writeFileSync(path, data);
		} catch (err) {
			console.error(err);
			return err.code;
		}
	}

	mimeType (path) {
		return (require('mime-lite')).getType(path);
	}

	/* PRIVATE METHODS */

	#readSettings () {
		try {
			return JSON.parse(fs.readFileSync(settingsFile,{encoding:'utf8'}));
		} catch (err) {
			console.error(err);
			return {};
		}
	}
	#saveSettings () {
		fs.writeFileSync(settingsFile, JSON.stringify(this.settings, null, "\t"));
	}
}

module.exports = new Controller();
