# Makefile pour le projet Bataille Navale

BACKEND_DIR = app/backend
FRONTEND_DIR = app/frontend
CONSOLE_MAIN_CLASS = com.ehv.battleship.view.ConsoleMain
MVN_LOCAL_REPO = .m2/repository
MVN = mvn -Dmaven.repo.local=$(MVN_LOCAL_REPO)

# Compile le backend Java
compile:
	$(MVN) -pl $(BACKEND_DIR) -am compile

# Nettoie les artefacts Maven du backend
clean:
	$(MVN) -pl $(BACKEND_DIR) -am clean

# Lance toujours le jeu en mode console (sans API web)
run-console: compile
	java -cp $(BACKEND_DIR)/target/classes $(CONSOLE_MAIN_CLASS)

# Alias demandé: make makerun
makerun: run-console

# Compatibilité avec l'ancienne commande
run: run-console

# Tests : backend (JUnit) + frontend (Vitest).
test:
	$(MVN) -pl $(BACKEND_DIR) -am test
	cd $(FRONTEND_DIR) && npm test -- --run

# Lint : ESLint frontend + Spotless backend (profil dédié).
lint:
	cd $(FRONTEND_DIR) && npm run lint
	$(MVN) -pl $(BACKEND_DIR) -Pspotless -am validate

# Vérification complète (utilisée par la CI).
check: lint test

# Règle par défaut
all: compile

.PHONY: compile clean run-console makerun run test lint check all

