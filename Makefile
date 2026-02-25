# Makefile pour le projet Bataille Navale

# Répertoire source
SRC_DIR = src
# Répertoire de sortie (répertoire courant)
OUT_DIR = .

# Trouver tous les fichiers Java dans src/
JAVA_FILES = $(shell find $(SRC_DIR) -name "*.java")

# Classe principale à exécuter
MAIN_CLASS = com.ehv.battleship.view.ConsoleMain

# Compiler tous les fichiers Java
compile:
	javac -d $(OUT_DIR) $(JAVA_FILES)

# Nettoyer les fichiers compilés
clean:
	find $(OUT_DIR) -name "*.class" -type f -delete

# Exécuter le jeu
run: compile
	java $(MAIN_CLASS)

# Règle par défaut
all: compile

.PHONY: compile clean run all

