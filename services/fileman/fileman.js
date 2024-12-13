'use strict';
const cntrlr = require('../../controller');
//const config = require('../../config');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');	//, {errors as formidableErrors} from 'formidable';
const formidableErrors = formidable.errors;		//require('formidable:errors');

module.exports = class Fileman {

	constructor () {
		this.debug = true;
	}

	action (what, parms, resp) {
		//console.log(what,parms);
		const baseDir = cntrlr.config.baseDir;
		let rmsg = 'NOT YET IMPLEMENTED';
		let pbase, fpath, stats;
		switch (what) {
		case 'fcomb':
			if (!fs.existsSync('/usr/bin/ffmpeg') && !fs.existsSync('/usr/local/bin/ffmpeg')) {
				rmsg = 'Required ffmpeg is not present';
				break;
			}
			pbase = baseDir+parms.dir+(parms.dir==''?'':'/');
			let eprms = '';
			for (const file of parms.files) {
				fpath = pbase+file;
				eprms += ` -i "${fpath}"`;
				stats = fs.statSync(fpath);
			}
			if (parms.files.length > 1) eprms += ' -codec copy';
			eprms += ` "${pbase+parms.asfile}"`;
			console.log(eprms);
			require('child_process').exec('ffmpeg -loglevel 16 -n'+eprms,{},(error, stdout, stderr)=>{
					console.log(error);
					rmsg = error ? String(error) : null;
					resp.end(rmsg);
				});
			return;
			rmsg = null;
			break;
		case 'fdele':
			pbase = baseDir+parms.dir+(parms.dir==''?'':'/');
			for (const file of parms.files) {
				fpath = pbase+file;
				stats = fs.statSync(fpath);
				if (stats.isDirectory()) {
					fs.rmSync(fpath, {recursive: true, force: true});
				} else {
					fs.unlinkSync(fpath);
				}
			}
			rmsg = null;
			break;
		case 'fdnld':
			if (parms.files.length>1) {
				rmsg = JSON.stringify({err: 'Multiple file download not yet implemented'});
				break;
			}
			fpath = baseDir+parms.dir+parms.files[0];
			stats = fs.statSync(fpath);
			if (stats.isDirectory()) {
				rmsg = JSON.stringify({err: 'Multiple file (i.e. folder) download not yet implemented'});
				break;
			}
			rmsg = JSON.stringify({err: '', fnam: parms.files[0], f64: btoa(fpath)});
			break;
		case 'fmove':
			let fdir = baseDir+parms.fdir;
			let tdir = baseDir+parms.tdir;
			for (const file of parms.files) {
				fs.renameSync(fdir+file, tdir+file);
			}
			rmsg = null;
			break;
		case 'fnewf':
			let pdir = baseDir+parms.dir;
			fs.mkdirSync(path.join(pdir, parms.newf));
			rmsg = null;
			break;
		case 'frnam':
			pbase = baseDir+parms.dir+(parms.dir==''?'':'/');
			fs.renameSync(pbase+parms.file, pbase+parms.to);
			rmsg = null;
			break;
		case 'funzp':
			pbase  = baseDir+parms.dir+(parms.dir==''?'':'/');
			require('child_process').exec('unzip -d "'+pbase+'" "'+pbase+parms.file+'"',{},(error, stdout, stderr)=>{
					console.log(error);
					rmsg = error ? String(error) : null;
					resp.end(rmsg);
				});
			return;
			break;
		case 'faddl':
			pbase = baseDir+parms.dir;
			console.log(pbase,parms.files);
			let plst = '';
			for (const file of parms.files) {
				plst += pbase+file + "\n";
			}
			const pld = cntrlr.config.playlistDir;
			try {
				fs.mkdir(pld, {recursive:true}, (err) => {
					if (err) throw err;
					fs.writeFileSync(pld+btoa(parms.plnam), plst);
				});
				// file written successfully
				resp.end('Playlist saved');
			} catch (err) {
				console.error(err);
				rmsg = 'Failed to write playlist';
			}
			return;
			break;
		case 'fview':
			fpath = baseDir+parms.fpath;
	// @@@@@@@@@@
	// could get file type here and send to client for display adjustments
	//		stats = fs.statSync(fpath);
	//		console.log(stats);
			rmsg = JSON.stringify({err: '', f64: btoa(fpath)});
			break;
		case 'sndf':
			this.sendFile(parms, resp);
			return;
			break;
		case 'dirl':
			const dpath = parms.dirl;
			this.getNavMenu(dpath, resp);
			this.getDirList(dpath, resp);
			return;
			break;
		case 'splay':
			fpath = baseDir+parms.fpath;
			rmsg = JSON.stringify({err: 'NOT YET IMPLEMENTED', f64: btoa(fpath)});
			break;
		case 'load':
			resp.end(cntrlr.readFile('services/fileman/fileman.html', 'FAILED TO READ'));
			return;
			break;
		}
		resp.end(rmsg);
	}

	getDirList (dir, resp) {
		const baseDir = cntrlr.config.baseDir;
		const idtf = new Intl.DateTimeFormat('en-US',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hour12:false,timeZoneName:'short'});
		fs.readdir(baseDir+dir, {withFileTypes: true}, (err, files) => {
			if (err) throw err;
			let rows = ['<thead><td></td><th>Name</th><th>Size </th><th> Date</th></thead>'];
			let pdir = dir == '' ? dir : (dir+'/');
			for (const file of files) {
				let fcl, icn, lnk='';
				if (file.isDirectory()) {
					icn = '<i class="fa fa-folder fa-fw d-icn" aria-hidden="true"></i>';
					fcl = 'isdir" data-dpath="'+pdir+file.name;
				} else {
					icn = '<i class="fa fa-file-o fa-fw" aria-hidden="true"></i>';
					fcl = 'isfil" data-fpath="'+file.name;
				}
				if (file.isSymbolicLink()) {
					lnk = ' <i class="fa fa-arrow-right fa-fw" aria-hidden="true"></i>';
					let lnk2 = fs.readlinkSync(baseDir+dir+'/'+file.name);
				//	if (fs.statSync(lnk2).isDirectory()) {
				//		fcl = 'isdir" data-dpath="'+lnk2;
				//	}
					lnk += lnk2;
				}
				const fstat = fs.statSync(baseDir+dir+'/'+file.name);
				rows.push('<td><input type="checkbox" class="fsel" name="files[]" value="'+file.name+'"></td>'
					+'<td class="'+fcl+'">'+icn+file.name+lnk+'</td>'
					+'<td>'+this.#formatNumber(fstat.size)+' </td>'
					+'<td> '+idtf.format(fstat.mtimeMs)+'</td>');
			}
			resp.write('<table><tr>'+rows.join('</tr><tr>')+'</tr></table>');
			resp.end();
		});
	}

	getNavMenu (dir, resp) {
		let nav = '<div class="fmnav">';
		let _D = '';
		let parts = dir.split('/');
		if (parts[0]) {
			nav += '<span class="isdir" data-dpath=""><i class="fa fa-home" aria-hidden="true"></i></span> / ';
		} else {
			nav += '<span><i class="fa fa-home" aria-hidden="true"></i></span>';
		}
		do {
			let _d = parts.shift();
			let _dd = _d;
			if (parts.length) {
				_D += _d + (parts.length>1 ? '/' : '');
				nav += `<span class="isdir" data-dpath="${_D}">${_dd}</span> / `;
			} else {
				nav += `<span>${_d}</span>`;
			}
		} while (parts.length);
		resp.write(nav+'</div>');
	}

	sendFile (parms, resp) {
		//console.log('[Info] Sending zip file');
		let filePath = atob(parms.sndf);
		let stats = fs.statSync(filePath);
		resp.setHeader('Content-Length', stats.size);
		if (parms.v) {
			const mtyp = cntrlr.mimeType(filePath) || 'audio/mp4';
			resp.setHeader('Content-Type', mtyp);
		} else {
			resp.setHeader('Content-Type', 'application/octet-stream');
			resp.setHeader('Content-Disposition', 'attachment; filename="'+path.basename(filePath)+'"');
		}
		let stream = fs.createReadStream(filePath);
		stream.on('open', () => {
			stream.pipe(resp);
		});
		stream.on('error', () => {
			resp.setHeader('Content-Type','text/plain');
			resp.status(404).end('Not found');
		});
	}

	async receiveUpload (req, res) {
		const baseDir = cntrlr.config.baseDir;
		const form = new formidable.IncomingForm({uploadDir: cntrlr.config.upldTmpDir, maxFileSize: 2147483648});	// formidable({});
		return await form.parse(req, function(err, fields, files) {
			if (err) {
				console.error(err);
				res.writeHead(err.httpCode || 400, {'Content-Type': 'text/plain'});
				res.end(String(err));
			} else {
				fs.renameSync(files.upld.filepath, path.join(baseDir+fields.dir, files.upld.originalFilename));
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end(JSON.stringify({ fields, files }, null, 2));
			}
		});
	};


	#formatNumber (num) {
		if (num < 1024) {
			return num.toString();
		} else if (num < 1048576) {
			return (num / 1024).toFixed(1) + 'K';
		} else if (num < 1073741824) {
			return (num / 1048576).toFixed(1) + 'M';
		} else {
			return (num / 1073741824).toFixed(1) + 'G';
		}
	}


}