const llogaria = 'ddoagbtbx';
const profiliNgarkimit = 'nexuscloud_docs';

const zonaLeshimit = document.getElementById('zona-leshimit');
const inputDokumentit = document.getElementById('dokumenti-hyrja');
const butoniShfletimit = document.getElementById('butoni-shfletimit');
const kutiaProgresit = document.getElementById('kutia-progresit');
const shiritiProgresit = document.getElementById('shiriti-progresit');
const tekstiProgresit = document.getElementById('vijushmeria');
const emriDokumentit = document.getElementById('emri-dokumentit');
const rrjetiInventarit = document.getElementById('rrjeti-inventarit');

if (zonaLeshimit) {
  const anuloVeprimet = (e) => { e.preventDefault(); e.stopPropagation(); };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ngjarje => {
    zonaLeshimit.addEventListener(ngjarje, anuloVeprimet, false);
  });

  ['dragenter', 'dragover'].forEach(ngjarje => {
    zonaLeshimit.addEventListener(ngjarje, () => zonaLeshimit.classList.add('aktiv'), false);
  });

  ['dragleave', 'drop'].forEach(ngjarje => {
    zonaLeshimit.addEventListener(ngjarje, () => zonaLeshimit.classList.remove('aktiv'), false);
  });

  zonaLeshimit.addEventListener('drop', (e) => dërgoTëDhënat(e.dataTransfer.files), false);
  butoniShfletimit.addEventListener('click', () => inputDokumentit.click());
  inputDokumentit.addEventListener('change', function () { dërgoTëDhënat(this.files); });

  const dërgoTëDhënat = (skedarët) => { [...skedarët].forEach(nisNgarkimin); };

  const nisNgarkimin = (skedar) => {
    const rruga = `https://api.cloudinary.com/v1_1/${llogaria}/upload`;
    const kërkesa = new XMLHttpRequest();
    const formulari = new FormData();

    kërkesa.open('POST', rruga, true);

    kërkesa.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const vlera = Math.round((e.loaded / e.total) * 100);
        kutiaProgresit.classList.remove('i-fshehur');
        shiritiProgresit.style.width = `${vlera}%`;
        tekstiProgresit.textContent = `PËRPUNIMI:[${vlera}%]`;
        emriDokumentit.textContent = skedar.name;
      }
    });

    kërkesa.onreadystatechange = async function () {
      if (kërkesa.readyState === 4 && kërkesa.status === 200) {
        const përgjigja = JSON.parse(kërkesa.responseText);

        // Pasi dokumenti ruhet në Cloudinary, njoftojmë backend-in tonë
        try {
          const token = localStorage.getItem('token');
          const dokumentiRij = {
            filename: përgjigja.original_filename,
            format: përgjigja.format,
            resource_type: përgjigja.resource_type,
            url: përgjigja.secure_url
          };

          const saveReq = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dokumentiRij)
          });

          if (saveReq.ok) {
            const docData = await saveReq.json();
            setTimeout(() => {
              kutiaProgresit.classList.add('i-fshehur');
              shiritiProgresit.style.width = '0%';
              ruajNëEksran(docData);
            }, 800);
          } else {
            console.error('Nuk arriti të ruhet në databazën lokale:', await saveReq.json());
            setTimeout(() => {
              kutiaProgresit.classList.add('i-fshehur');
              shiritiProgresit.style.width = '0%';
            }, 800);
          }
        } catch (err) {
          console.error('Gabim lidhjeje me serverin:', err);
        }
      }
    };

    formulari.append('file', skedar);
    formulari.append('upload_preset', profiliNgarkimit);
    formulari.append('resource_type', 'auto');
    formulari.append('access_type', 'anonymous');

    kërkesa.send(formulari);
  };

  const ruajNëEksran = (elementi) => {
    // Sigurohemi që marrim URL-në e saktë (nga backend vjen si 'url', nga Cloudinary direct si 'secure_url')
    const finalUrl = elementi.url || elementi.secure_url;
    const finalId = elementi.id;

    if (!finalUrl) return;

    const eshteImazh = elementi.resource_type === 'image';
    const vizualizimi = eshteImazh
      ? `<img src="${finalUrl}" alt="${elementi.filename}">`
      : `<svg class="ikona-dokumentit" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;

    const kutia = document.createElement('div');
    kutia.className = 'kuti-aseti';
    if (finalId) kutia.id = `doc-${finalId}`;

    kutia.innerHTML = `
      <a href="${finalUrl}" target="_blank" class="parapamja-link">
        <div class="parapamja-asetit">${vizualizimi}</div>
      </a>
      <div class="te-dhenat-asetit">
        <div class="emri-asetit">${elementi.filename}.${elementi.format}</div>
        <div class="lloji-asetit">${elementi.resource_type} / ${elementi.format}</div>
        ${finalId ? `<button class="butoni-fshirjes" onclick="fshiDokumentin('${finalId}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>` : ''}
      </div>
    `;
    rrjetiInventarit.prepend(kutia);
  };

  window.fshiDokumentin = (id) => {
    if (!id || id === 'undefined') {
        alert('Gabim: ID e dokumentit nuk u gjet.');
        return;
    }

    if (!confirm('A jeni të sigurt që dëshironi ta fshini këtë dokument?')) return;
    
    // ZGJIDHJA DEFINITIVE DHE E THJESHTË:
    // Përdorim rrugën e re emergjente për të anashkaluar keshimin
    window.location.href = `/fshirja-emergjente/${id}?token=${localStorage.getItem('token')}`;
  };

  const ngarkoDokumentet = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const dokumentet = await res.json();
        // i kthejmë përmbys listën nëse e lartmja duhet të jetë më e reja (ose i bëjmë append nqs prepend)
        // databaza i kthen ORDER BY created_at DESC, pra të parat janë të rejat
        // ruajNëEksran bën prepend, ndaj i kalojmë nga i fundit tek i pari për të mbajtur renditjen
        dokumentet.reverse().forEach(dok => {
          ruajNëEksran({
            id: dok.id,
            secure_url: dok.url,
            filename: dok.filename,
            format: dok.format,
            resource_type: dok.resource_type
          });
        });
      }
    } catch (err) {
      console.error('Gabim duku ngarkuar dokumentet:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', ngarkoDokumentet);
}

const formaKontaktit = document.querySelector('.forma-kontaktit');

if (formaKontaktit) {
  formaKontaktit.addEventListener('submit', async function (e) {
    e.preventDefault();

    const theForm = e.target;
    const bodyData = new FormData(theForm);

    try {
      const response = await fetch(theForm.action, {
        method: theForm.method,
        body: bodyData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        window.alert('Mesazhi u dërgua me sukses! Faleminderit që na kontaktuat.');
        theForm.reset();
      } else {
        window.alert('Ndodhi një problem gjatë dërgimit.');
      }
    } catch (error) {
      window.alert('Ndodhi një gabim në rrjet.');
    }
  });
}

// Menaxhimi i Menysë në Mobile
const menyToggle = document.getElementById('meny-toggle');
const lidhjetNav = document.getElementById('lidhjet-navigimit');

if (menyToggle && lidhjetNav) {
  menyToggle.addEventListener('click', () => {
    menyToggle.classList.toggle('aktiv');
    lidhjetNav.classList.toggle('aktiv');
  });

  // Mbyllja e menysë kur klikohet një lidhje
  document.querySelectorAll('.lidhja-kthyese').forEach(lidhje => {
    lidhje.addEventListener('click', () => {
      menyToggle.classList.remove('aktiv');
      lidhjetNav.classList.remove('aktiv');
    });
  });
}