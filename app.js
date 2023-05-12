const axios = require('axios');
const xml2js = require('xml2js');
const unzip = require('unzip-stream');
const parser = new xml2js.Parser();

const data = '05/04/2023';

carga(data);

async function carga(txtData) {
  const url = 'http://seguro.bmfbovespa.com.br/rad/download/SolicitaDownload.asp';
  const bodyForm = `txtLogin=397DWLGALO&txtSenha=33748C83&txtData=${txtData}&txtHora=00:00&txtAssuntoIPE=Sim&txtDocumento=DFP`;
  
  try {
    // Faz a solicitação POST e obtém a resposta dos links
    const resLinks = await axios.post(url, bodyForm, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const data = await parser.parseStringPromise(resLinks.data);
    const links = data.DownloadMultiplo.Link;

    for await (const link of links) {
      const url = link.$.url;
      // Faz a solicitação GET para cada URL e obtém o conteúdo do arquivo XML
      const resUnzip = await axios.get(url, { responseType: 'stream' });
      const arquivos = await descomprimir(resUnzip.data);
      console.log(arquivos);
    }
  } catch (error) {
    console.error('Erro ao converter XML para JSON:', error);
  }
}

async function descomprimir(data) {
  const unzipStream = data.pipe(unzip.Parse());
  const listFiles = [];

  if (isZipFile(data._outBuffer)) {
    for await (const entry of unzipStream) {
      const extension = entry.path.split('.')[1];
      if (extension !== 'xml') continue;

      if (!entry.isDirectory && entry.type === 'File') {
        // Obtém o conteúdo do arquivo XML e faz o parse para JSON
        const fileContent = await new Promise((resolve, reject) => {
          let content = '';
          entry.on('data', chunk => { content += chunk.toString(); });
          entry.on('end', () => { resolve(content); });
          entry.on('error', reject);
        });
        // Conteúdo do arquivo XML
        console.log('Arquivo XML:', fileContent);
        // Gravar esse JSON no banco de dados
        const jsonXML = await parser.parseStringPromise(fileContent);
        listFiles.push(jsonXML);
      } else {
        // Ignora diretórios e outros tipos de entrada
        entry.autodrain();
      }
    }
  } else {
    console.error('Zip nivalido.');
  }

  return listFiles;
}

function isZipFile(buffer) {
  // Verifica se o buffer tem o cabeçalho de um arquivo zip válido
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}