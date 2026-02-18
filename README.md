Bataille Navale - Architecture MVC stricte

Structure
- model : modèle Java pur
- app/backend : backend Spring Boot
- app/frontend : frontend React
- app/desktop : client desktop Tauri

Prérequis
- Java 17
- Maven
- Node.js
- Rust (pour Tauri)

Commandes principales
- Java (modèle + backend) : mvn -q -DskipTests package
- Backend : (cd app/backend) mvn -q -DskipTests spring-boot:run
- Frontend : npm install puis npm run dev
- Desktop : npm install puis npm run tauri dev

Lancer l'app (démarches)
1) Backend (API Spring Boot)
	- cd app/backend
	- mvn -q -DskipTests spring-boot:run
	- L'API écoute sur http://localhost:8080
2) Frontend (React)
	- cd app/frontend
	- npm install
	- npm run dev
	- Interface sur http://localhost:5173
3) Desktop (Tauri)
	- cd app/desktop
	- npm install
	- npm run tauri:dev

Notes
- Remplacer les versions et paramètres selon votre environnement.
