const axios = require('axios');
const xml2js = require('xml2js');
const unzip = require('unzip-stream');

const parser = new xml2js.Parser();

const url = 'http://seguro.bmfbovespa.com.br/rad/download/SolicitaDownload.asp';
const data = 'txtLogin=397DWLGALO&txtSenha=33748C83&txtData=05/04/2023&txtHora=00:00&txtAssuntoIPE=Sim&txtDocumento=DFP';

(async () => {
  try {
    // Faz a solicitação POST e obtém a resposta XML
    const res = await axios.post(url, data, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const result = await parser.parseStringPromise(res.data);
    const links = result.DownloadMultiplo.Link;

    for (const link of links) {
      const url = link.$.url;

      // Faz a solicitação GET para cada URL e obtém o conteúdo do arquivo XML
      const response = await axios.get(url, { responseType: 'stream' });
      const unzipStream = response.data.pipe(unzip.Parse());

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
        } else {
          // Ignora diretórios e outros tipos de entrada
          entry.autodrain();
        }
      }
    }
  } catch (error) {
    console.error('Erro ao converter XML para JSON:', error);
  }
})();