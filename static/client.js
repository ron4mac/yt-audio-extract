'use strict';
var _pp = 0;
var _pb, _fm;
var curDir;
const getPlaylist = (frm) => {
	let yturl = encodeURIComponent(frm.yturl.value.trim());
	let wtrk = encodeURIComponent(frm.wtrk.value);
	document.getElementById('dnldf').src = window.location.origin + `?pxtr=${yturl}&wtrk=${wtrk}`;
	watchP();
};
const getVinfo = (frm) => {
	let yturl = encodeURIComponent(frm.yturl.value.trim());
	let tname = encodeURIComponent(frm.tname.value.trim());
	let wtrk = encodeURIComponent(frm.wtrk.value);
	tname = tname ? tname : 'audio_track';
	document.getElementById('dnldf').src = window.location.origin + `?axtr=${yturl}&tnam=${tname}&wtrk=${wtrk}`;
};
const watchP = () => {
	fetch('?prog', {method:'GET'})
	.then((resp) => resp.text())
	.then(data => {
		if (data == '.') {
			_pb.innerHTML = '';
			document.getElementById('dnldf').src = 'playlist.zip';
		} else {
			_pb.innerHTML = data;
			setTimeout(watchP, 1000);
		}
	});
};
const dlfile = () => {
	document.getElementById('dnldf').src = 'video.mp4';
};
const frequest = (evt, frm) => {
	evt.preventDefault();
//	console.log(evt);
	if (evt.submitter.name=='ginf') getVinfo(frm);
};
const prequest = (evt, frm) => {
	evt.preventDefault();
//	console.log(evt);
	if (evt.submitter.name=='ginf') getPlaylist(frm);
};
var tabcontent, tablinks;
var fileseen = false;
const openTab = (evt, tabName, cb) => {
	let i;
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = 'none';
	}
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(' active', '');
	}
	// Show the current tab, and add an "active" class to the button that opened the tab
	document.getElementById(tabName).style.display = 'block';
	evt.currentTarget.className += ' active';
	if (typeof cb === 'function') cb();
};
const getDirList = (dirPath) => {
	fetch('?dirl='+encodeURIComponent(dirPath), {method:'GET'})
	.then((resp) => resp.text())
	.then(data => {
		_fm.innerHTML = data;
		curDir = dirPath;
		const dirs = _fm.querySelectorAll('.isdir');
		dirs.forEach(elm => {
			elm.addEventListener('click', (evt) => {
				console.log(evt);
				let todir = evt.target.dataset.dpath || evt.target.parentNode.dataset.dpath || '';
				getDirList(todir);
			});
		});
	});
};
const fmpop = () => {
	if (!fileseen) getDirList('');
	fileseen = true;
};
const doMenu = (actn, evt) => {
	console.log(actn);
	const slctd = document.querySelectorAll('.fsel:checked'),
		scnt = slctd.length,
		oneItem = () => { if (!scnt) { alert('An item needs to be selected'); } else if (scnt>1) { alert('Please select only one item.'); } else { return true; } return false; },
		hasSome = () => { if (scnt) { return true; } alert('Some items need to be selected'); return false; };
	switch (actn) {
	case 'fdele':
		if (hasSome() && ((scnt==1) || confirm('You have multiple files selected. Are you sure you want to delete ALL the selected files?'))) {
			const files = Array.from(slctd).map(el => el.value);
			//let usp = new URLSearchParams({act:'fdele','dir': curDir,'files': files});
			postAndRefresh({act:'fdele','dir': curDir,'files': files}, 1);
		}
		break;
	case 'fdnld':
		if (hasSome()) {
			const files = Array.from(slctd).map(el => el.value);
			postAction(null, {act:'fdnld','dir': curDir?(curDir+'/'):'','files': files}, (data) => {
				if (data) {
					console.log(data);
					if (data.err) {
						alert(data.err);
					} else {
						document.getElementById('dnldf').src = '/?sndf='+data.f64;
					}
				} else { alert('download not available'); }
			}, 2);
		}
		break;
	case 'fmove':
		if (scnt) {
			const files = Array.from(slctd).map(el => el.value);
			let usp = JSON.stringify({'fdir': curDir?(curDir+'/'):'','files': files});
			sessionStorage.nfm_mvto = usp;
			evt.target.innerHTML = `Move(${files.length})`;
		} else {
			if (!sessionStorage.nfm_mvto) {
				alert('Nothing previously selected to move');
				break;
			}
			let parms = JSON.parse(sessionStorage.nfm_mvto);
			parms.act = 'fmove';
			parms.tdir = curDir?(curDir+'/'):'';
			sessionStorage.removeItem('nfm_mvto');
			postAndRefresh(parms, 1);
		}
		break;
	case 'frnam':
		if (oneItem())  {
			let curfn = slctd[0].value;
			let nnam = prompt(`Rename ${curfn} to:`);
			if (nnam) {
				postAndRefresh('act=frnam&dir='+encodeURIComponent(curDir)+'&file='+encodeURIComponent(curfn)+'&to='+encodeURIComponent(nnam));
			//	postAndRefresh({act: 'frnam',dir: curDir,file: curfn,to: nnam});
			}
		}
		break;
	case 'fupld':
//		sessionStorage.nfm_curD = curDir;
		if (doesSupportAjaxUploadWithProgress()) {
			if (upload_winpop) {
				upldAction.H5w();
			} else {
				upldAction.H5o();
			}
		} else {
			if (upload_winpop) {
				upldAction.L4w();
			} else {
				upldAction.L4o();
			}
		}
		break;
	case 'funzp':
		if (oneItem()) {
			curfn = /*curDir+*/$(slctd[0]).parents('tr').attr('data-fref');
			trmFrm = document.forms.cliterm;
			if (cmd=='zip') {
				var zcmd = 'zip ';
				if ($(slctd[0]).parent().next().hasClass('foldCtxt')) { zcmd += '-r '; }
				destfn = curfn.replace(/\s/g,'_');
				trmFrm.cmdlin.value = zcmd+destfn+'.zip "'+curfn+'"';
				if (evt.shiftKey) {
					let xyz = prompt('COMMAND:',trmFrm.cmdlin.value+' -x "*/sv_*" -x "*/.git*"');
					if (xyz) { trmFrm.cmdlin.value = xyz; }
					else break;
				}
			} else if (cmd=='uzip') {
				trmFrm.cmdlin.value = 'unzip "'+curfn+'"';
			} else if (cmd=='tarz') {
				destfn = curfn.replace(/\s/g,'_');
				trmFrm.cmdlin.value = 'tar -czf '+destfn+'.tgz "'+curfn+'"';
			} else if (cmd=='utrz') {
				trmFrm.cmdlin.value = 'tar -xzf "'+curfn+'"';
			}
			trmFrm.submit();
		}
		break;
	}
};

const toFormData = (obj) => {
	const formData = new FormData();
	Object.keys(obj).forEach(key => {
		if (typeof obj[key] !== 'object') formData.append(key, obj[key]);
		else formData.append(key, JSON.stringify(obj[key]));
	});
	return formData;
};

// json 1 to send, 2 to send and receive
const postAction = (act, parms={}, cb=()=>{}, json=false) => {
	let hdrs = {};
	if (typeof parms === 'object') {
		if (json) {
			parms = JSON.stringify(parms);
		} else {
			if (!(parms instanceof FormData)) parms = toFormData(parms);
		}
	} else if (typeof parms === 'string') {
		if (!json) parms = new URLSearchParams(parms);
	}
	if (json) hdrs['Content-Type'] = 'application/json';
	if (act) parms.set('act', act);

	fetch('?_FM', {method:'POST', headers:hdrs, body:parms})
	.then(resp => { if (!resp.ok) throw new Error('Network response was not OK'); if (json==2) return resp.json(); else return resp.text() })
	.then(data => cb(data))
	.catch(err => alert(err));
};

const postAndRefresh = (parms, json=false) => {
	postAction(null, parms, (data) => { if (data) alert(data); else getDirList(curDir) }, json);
};
