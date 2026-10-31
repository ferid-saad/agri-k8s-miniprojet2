const app = require('./app');
const { initDb } = require('./db');

const PORT = process.env.API_PORT;
if (!PORT) {
  console.error("Variable d'environnement manquante : API_PORT");
  process.exit(1);
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`irrigation-service écoute sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erreur de connexion à la base :', err.message);
    process.exit(1);
  });