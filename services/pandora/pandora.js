'use strict';
const cntrlr = require('../../controller');
const Connect = require('./connect');
const WebSocket = require('ws');

module.exports = class Pandora {

	constructor (client, mpdc, full=false) {
		this.client = client;
		this.mpdc = mpdc;
		this.queue = {};
		if (full) {
			this.ws = new WebSocket.Server({port:cntrlr.config.pandora_socket});
			this.ws.on('connection', (sc) => {
				sc.on('error', console.error);
				sc.on('message', (data) => {
					console.log('received: %s', data);
				});
				// if message was 'probe' send albumart to this one connection
				this.mpdc._status()
				.then((stat) => {
					let msg;
					if (stat.songid && this.queue[stat.songid]) {
						msg = {...{state: stat.state}, ...{snam: this.stationName}, ...this.queue[stat.songid]};
						console.log(msg);
					} else {
						return;		//msg = {state: stat.state};
					}
					sc.send(JSON.stringify(msg));
				});
			});
			this._playSocket();
		}
	}

	static async init (mpdc, settings) {
		const client = new Connect(settings.pandora_user, settings.pandora_pass);
		let rslt = false;	//await this._login(client);
		return rslt ? null : new Pandora(client, mpdc, true);
	}

	action (what, bobj, resp) {
		switch (what) {
		case 'home':
			this.authenticated()
			.then(yn => {
				if (yn) {
					let b = (bobj!=='undefined') ? atob(bobj) : '';
					this.browse(b, resp);
				} else {
					resp.write('<span class="warning">You are not authenticated with Pandora. ');
					resp.end('Please login to Pandora (upper-right user icon)</span>');
				}
			});
/*			if (!this.authenticated()) {
				resp.write('<span class="warning">You are not authenticated with Pandora. ');
				resp.end('Please login to Pandora (upper-right user icon)</span>');
				return;
			}
			console.log('p-brose');
			let b = (bobj!=='undefined') ? atob(bobj) : '';
			this.browse(b, resp);*/
			break;
		case 'play':
			this.play(bobj, resp);
			break;
		case 'clear':
			this.mpdc.clear();
			resp.end();
			break;
		case 'user':
			const htm = this.client.authData ? 'user.html' : 'login.html';
			resp.end(cntrlr.readFile('services/pandora/'+htm+'', 'FAILED TO READ'));
			break;
		case 'load':
			this.authenticated()
			.then(() => {
				resp.end(cntrlr.readFile('services/pandora/pandora.html', 'FAILED TO READ'));
			});
			break;
		case 'delete':
			if (this.client.authData) {
				this.client.request('station.deleteStation', {stationToken: bobj}, (err, nada) => {
					resp.end();
				});
			} else {
				resp.end('Not Authorized');
			}
			break;
		case 'search':
			if (this.client.authData) {
				this.client.request('music.search', {searchText: bobj, includeNearMatches: true, includeGenreStations: true}, (err, data) => {
				//	console.log(data);
					resp.write(this._parseSearch(data));
					resp.end();
				});
			} else {
				resp.end('Not Authorized');
			}
			break;
		case 'add':
			if (this.client.authData) {
				this.client.request('station.createStation', bobj, (err, data) => {
					//console.log(data);
					let msg = data.stationName ? ('Created Station "'+data.stationName+'"') : 'FAILED TO CREATE STATION';
					resp.end(msg);
				});
			} else {
				resp.end('Not Authorized');
			}
			break;
		case 'login':
			this._login(this.client, bobj.user, bobj.pass)
			.then(()=>{
				if (this.client.authData) {
					cntrlr.setSettings({pandora_user: bobj.user, pandora_pass: bobj.pass});
					resp.end();
				} else {
					resp.end('FAILED TO AUTHENTICATE');
				}
			});
			break;
		case 'reauth':
			this.client.authData = null;
			this._login(this.client, cntrlr.settings.pandora_user, cntrlr.settings.pandora_pass)
			.then(()=>{
				if (this.client.authData) {
					resp.end();
				} else {
					resp.end('FAILED TO AUTHENTICATE');
				}
			});
			break;
		case 'logout':
			this.client.authData = null;
			cntrlr.deleteSettings(['pandora_user','pandora_pass']);
			this._login(this.client, bobj.user, bobj.pass)
			resp.end();
			break;
		default:
			resp.end('Unknown webPandora: '+what);
			break;
		}
	}

	browse (surl, resp) {
		if (this.client.authData) {
			// can get image sizes .. 90,130,250,500,640,1080
			this.client.request('user.getStationList', {includeStationArtUrl: true, stationArtSize: 'W250H250'}, (err, stationList) => {
				console.log(stationList);
				if (stationList) {
					resp.write(this._parseStations(stationList.stations));
					resp.end();
				} else {
					console.log(err);
					resp.end('-- Failed connection to Pandora ... may need to refresh authorization --');
				}
			});
		} else {
			resp.end('-- NYA --');
		}
	}

	play (station, resp) {
		this.mpdc.sendCommand('clear');
		this.stationid = station.sid;
		this.stationName = station.snam;
		this._getTracks();
		resp.end();
	}

	// used to authenticate login
	async authenticated () {
		if (this.client.authData) return true;
		const sets = cntrlr.settings;
		if (!sets.pandora_user) return false;
		console.log('trying to authenticate');
		const yn = await this._login(this.client, sets.pandora_user, sets.pandora_pass)
		.then(rslt => {
			console.log('pdor auth',rslt);
			return !rslt;
		});
		return yn;
	}


	// private methods
	_parseStations (list) {
		if (!list) return 'NOT YET RESOLVED';
		let htm = '';
		for (const s of list) {
			htm += '<div data-sid="'+s.stationId+'"><i class="fa fa-bars" aria-hidden="true" onclick="Pand.more(event)"></i>';
			htm += '<a href="#" onclick="Pand.play(event)">'+s.stationName+'</a></div>'
		}
		return htm;
	}

	_parseSearch (rslt) {
		let htm = '';
		if (rslt.songs && rslt.songs.length) {
			htm += '<div class="subs">By Songs</div>';
			rslt.songs.forEach((s)=>{
				htm += '<div data-mtkn="'+s.musicToken+'"><i class="fa fa-plus-square-o" aria-hidden="true" onclick="Pand.add(event,\'song\')"></i>'+s.artistName+' :: '+s.songName+'</div>';
			});
		}
		if (rslt.artists && rslt.artists.length) {
			htm += '<div class="subs">By Artists</div>';
			rslt.artists.forEach((a)=>{
				htm += '<div data-mtkn="'+a.musicToken+'"><i class="fa fa-plus-square-o" aria-hidden="true" onclick="Pand.add(event,\'artist\')"></i>'+a.artistName+'</div>';
			});
		}
		if (rslt.genreStations && rslt.genreStations.length) {
			htm += '<div class="subs">By Genres</div>';
			rslt.genreStations.forEach((g)=>{
				htm += '<div data-mtkn="'+g.musicToken+'"><i class="fa fa-plus-square-o" aria-hidden="true" onclick="Pand.add(event,\'song\')"></i>'+g.stationName+'</div>';
			});
		}
		return htm;
	}

	_getTracks () {
		let gplp = {stationToken: this.stationid, additionalAudioUrl: 'HTTP_128_MP3'};
		this.client.request('station.getPlaylist', gplp, (err, playlist) => {
			if (err) {
				console.error(err);
				setTimeout(()=>this._getTracks, 15000);
			} else {
		//	console.log(playlist);
				if (playlist) this._queueTracks(playlist.items);
			}
		});
	}

	_queueTracks (items) {
		try {
			for (const t of items) {
				if (t.additionalAudioUrl) {
					this.mpdc.sendCommand('addid '+t.additionalAudioUrl)
					.then((rslt) => {
						let id = rslt.match(/\d+/)[0];
						console.log('add id',id);
						this.queue[id] = {
							artistName: t.artistName,
							albumName: t.albumName,
							songName: t.songName,
							albumArtUrl: t.albumArtUrl
						};
						this.lastAddedId = id;
					});
				} else {
					console.log(t);
				}
			}
			this.mpdc.sendCommand('play');
		} catch (error) {
			console.error(error);
		}
	}

	_playSocket () {
		if (this.ws) {
			this.mpdc.mpdc.on('system-player', (a,b) => {
				if (!this.client.authData) return;
				console.log('pdo on system player event ',a,b);
				this.mpdc._status()
				.then((stat) => {
					//console.log(stat);
					console.log(stat.song+'/'+stat.playlistlength);
					let msg;
					if (stat.songid && this.queue[stat.songid]) {
						msg = {...{state: stat.state}, ...{snam: this.stationName}, ...this.queue[stat.songid]};
						if (stat.playlistlength-stat.song < 2) {
							this._getTracks();
						}
						if ((stat.playlistlength > 15)&&(stat.song>7)) {
							this.mpdc.sendCommand('delete 0:4')
							.then(()=>this._cleanQueue());
						}
					} else {
						msg = {state: 'stop'};
					}
					console.log(msg);
					this.ws.clients.forEach((client) => {
						if (client.readyState === WebSocket.OPEN) {
							client.send(JSON.stringify(msg));
						}
					});
				});
			});
		}
	}

	_cleanQueue () {
		//clean up defunct queue info
		let base = this.lastAddedId - 20;
		for (const qid in this.queue) {
			if (qid<base) delete this.queue[qid];
		}
	}

	_login (client, user, pass) {
		return new Promise((resolve, reject) => {
			try {
				client.login(user, pass, (err) => {
					if (err) {
						console.log(err);
						resolve('Login Failure');
					} else {
						console.log('Pandora Ready!');
						resolve();
					}
				});
			} catch (error) {
				reject(error);
			}
		});
	}

}
