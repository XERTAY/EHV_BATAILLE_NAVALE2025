# Makefile pour le projet Bataille Navale

# Répertoire source
SRC_DIR = src
# Répertoire de sortie (répertoire courant)
OUT_DIR = .

# Trouver tous les fichiers Java dans src/
JAVA_FILES = $(shell find $(SRC_DIR) -name "*.java")

# Classe principale à exécuter
MAIN_CLASS = com.ehv.battleship.view.ConsoleMain

LIBS = lib/gson-2.10.1.jar

# Compiler tous les fichiers Java
compile:
	javac -cp $(LIBS) -d $(OUT_DIR) $(JAVA_FILES)

# Nettoyer les fichiers compilés
clean:
	find $(OUT_DIR) -name "*.class" -type f -delete

run: compile
	java -cp $(OUT_DIR):$(LIBS) $(MAIN_CLASS)

# Règle par défaut
all: compile

.PHONY: compile clean run all

