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

    kërkesa.onreadystatechange = function () {
      if (kërkesa.readyState === 4 && kërkesa.status === 200) {
        const përgjigja = JSON.parse(kërkesa.responseText);
        setTimeout(() => {
          kutiaProgresit.classList.add('i-fshehur');
          shiritiProgresit.style.width = '0%';
          ruajNëEksran(përgjigja);
        }, 800);
      }
    };

    formulari.append('file', skedar);
    formulari.append('upload_preset', profiliNgarkimit);
    formulari.append('resource_type', 'auto');
    formulari.append('access_type', 'anonymous');

    kërkesa.send(formulari);
  };

  const ruajNëEksran = (elementi) => {
    const eshteImazh = elementi.resource_type === 'image';
    const vizualizimi = eshteImazh
      ? `<img src="${elementi.secure_url}" alt="${elementi.original_filename}">`
      : `<svg class="ikona-dokumentit" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;

    const kutia = document.createElement('a');
    kutia.href = elementi.secure_url;
    kutia.target = '_blank';
    kutia.className = 'kuti-aseti';
    kutia.style.cursor = 'pointer';
    kutia.style.textDecoration = 'none';
    kutia.style.color = 'inherit';
    kutia.style.display = 'block';

    kutia.innerHTML = `
      <div class="parapamja-asetit">${vizualizimi}</div>
      <div class="te-dhenat-asetit">
        <div class="emri-asetit">${elementi.original_filename}.${elementi.format}</div>
        <div class="lloji-asetit">${elementi.resource_type} / ${elementi.format}</div>
      </div>
    `;
    rrjetiInventarit.prepend(kutia);
  };
}

const formaKontaktit = document.querySelector('.forma-kontaktit');

if (formaKontaktit) {
  formaKontaktit.addEventListener('submit', async function(e) {
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