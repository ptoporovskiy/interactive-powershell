// Interactive PowerShell - script.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Interactive PowerShell Builder Loaded!");

    // --- DOM Elements ---
    const verbSelect = document.getElementById('verb-select');
    const nounSelect = document.getElementById('noun-select');
    const parametersContainer = document.getElementById('parameters-container');
    const generatedCommandElement = document.getElementById('generated-command');
    const copyCommandButton = document.getElementById('copy-command');
    const addPipeButton = document.getElementById('add-pipe');
    const pipesContainer = document.getElementById('pipes-container');
    const exampleCards = document.querySelectorAll('.example-card');

    // --- State ---
    let commandParts = []; // To store each part of the command [{verb, noun, params:[]}, {verb, noun, params:[]}]
    let cmdletData = {}; // To store loaded cmdlets.json
    let parameterData = {}; // To store loaded parameters.json

    // --- Initial Load ---
    async function initializeApp() {
        await loadData();
        populateVerbs();
        // Any other initial setup
    }

    // --- Data Loading ---
    async function loadData() {
        try {
            const cmdletResponse = await fetch('data/cmdlets.json');
            cmdletData = await cmdletResponse.json();
            const parameterResponse = await fetch('data/parameters.json');
            parameterData = await parameterResponse.json();
            console.log("Data loaded:", { cmdletData, parameterData });
        } catch (error) {
            console.error("Failed to load data:", error);
            generatedCommandElement.textContent = "Error: Could not load cmdlet data.";
        }
    }

    // --- UI Population ---
    function populateVerbs() {
        if (!cmdletData.verbs) {
            console.error("cmdletData.verbs is undefined");
            return;
        }
        const verbs = Object.keys(cmdletData.verbs).sort();
        verbs.forEach(verb => {
            const option = document.createElement('option');
            option.value = verb;
            option.textContent = verb;
            verbSelect.appendChild(option);
        });
        verbSelect.disabled = false;
    }

    function populateNouns(selectedVerb) {
        nounSelect.innerHTML = '<option value="">Select a noun...</option>'; // Clear previous nouns
        nounSelect.disabled = true;
        parametersContainer.innerHTML = ''; // Clear params

        if (selectedVerb && cmdletData.verbs[selectedVerb]) {
            const nouns = cmdletData.verbs[selectedVerb].sort();
            nouns.forEach(noun => {
                const option = document.createElement('option');
                option.value = noun;
                option.textContent = noun;
                nounSelect.appendChild(option);
            });
            nounSelect.disabled = false;
        }
        updateGeneratedCommand();
    }

    function populateParameters(selectedCmdlet) { // e.g., "Get-ChildItem"
        parametersContainer.innerHTML = ''; // Clear previous parameters
        addPipeButton.disabled = true; // Disable pipe until cmdlet selected

        if (!selectedCmdlet || !parameterData.cmdlets[selectedCmdlet] || !parameterData.cmdlets[selectedCmdlet].parameters) {
            console.warn(`No parameters found for ${selectedCmdlet}`);
            if(selectedCmdlet) addPipeButton.disabled = false; // Enable if cmdlet is valid but no params
            updateGeneratedCommand();
            return;
        }

        const params = parameterData.cmdlets[selectedCmdlet].parameters;
        Object.entries(params).forEach(([paramName, paramDetails]) => {
            const paramItem = document.createElement('div');
            paramItem.classList.add('parameter-item');
            paramItem.dataset.paramName = paramName;

            const checkboxLabel = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('parameter-checkbox');
            checkbox.id = `param-${paramName}`;
            checkbox.dataset.paramName = paramName;
            checkboxLabel.htmlFor = checkbox.id;
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(document.createTextNode(` ${paramName} `));
            if(paramDetails.type !== "SwitchParameter") {
                 checkboxLabel.appendChild(document.createTextNode(` (${paramDetails.type || 'string'})`));
            }


            paramItem.appendChild(checkboxLabel);

            if (paramDetails.type !== "SwitchParameter" && paramDetails.type !== "System.Management.Automation.SwitchParameter") {
                const input = document.createElement('input');
                input.type = 'text';
                input.classList.add('parameter-input');
                input.placeholder = paramDetails.placeholder || `Enter value for ${paramName}`;
                input.disabled = true; // Initially disabled
                input.dataset.paramName = paramName;
                paramItem.appendChild(input);

                checkbox.addEventListener('change', (e) => {
                    input.disabled = !e.target.checked;
                    if (!e.target.checked) input.value = ''; // Clear value if unchecked
                    paramItem.classList.toggle('selected', e.target.checked);
                    updateGeneratedCommand();
                });
                input.addEventListener('input', updateGeneratedCommand);
            } else {
                checkbox.addEventListener('change', (e) => {
                    paramItem.classList.toggle('selected', e.target.checked);
                    updateGeneratedCommand();
                });
            }
            parametersContainer.appendChild(paramItem);
        });
        addPipeButton.disabled = false; // Enable pipe button after parameters are populated
        updateGeneratedCommand();
    }


    // --- Command Logic ---
    function updateGeneratedCommand() {
        let currentCommand = "";
        const selectedVerb = verbSelect.value;
        const selectedNoun = nounSelect.value;

        if (selectedVerb && selectedNoun) {
            currentCommand = `${selectedVerb}-${selectedNoun}`;

            const activeParameters = [];
            parametersContainer.querySelectorAll('.parameter-item').forEach(item => {
                const checkbox = item.querySelector('.parameter-checkbox');
                if (checkbox.checked) {
                    const paramName = checkbox.dataset.paramName;
                    const paramDetails = parameterData.cmdlets[`${selectedVerb}-${selectedNoun}`]?.parameters[paramName];

                    if (paramDetails && (paramDetails.type === "SwitchParameter" || paramDetails.type === "System.Management.Automation.SwitchParameter")) {
                        activeParameters.push(`-${paramName}`);
                    } else {
                        const input = item.querySelector('.parameter-input');
                        if (input && input.value.trim() !== '') {
                            // Add quotes if value contains spaces and isn't already quoted
                            let value = input.value.trim();
                            if (value.includes(' ') && !((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
                                value = `'${value}'`;
                            }
                            activeParameters.push(`-${paramName} ${value}`);
                        } else if (input) { // Parameter selected but no value - show placeholder if needed or just the flag
                           activeParameters.push(`-${paramName} <value>`); // Or decide how to handle empty values
                        }
                    }
                }
            });
            if (activeParameters.length > 0) {
                currentCommand += " " + activeParameters.join(" ");
            }
        }

        // Handle piped commands (simplified for now, needs proper structure)
        pipesContainer.querySelectorAll('.pipe-segment').forEach(segment => {
            // This will need to be more sophisticated to build command for each segment
            // For now, just placeholder
            // currentCommand += " | ...";
        });


        if (currentCommand) {
            generatedCommandElement.textContent = currentCommand;
            copyCommandButton.disabled = false;
        } else {
            generatedCommandElement.textContent = "Select a verb and noun to start building...";
            copyCommandButton.disabled = true;
        }
    }


    // --- Event Listeners ---
    verbSelect.addEventListener('change', (e) => {
        populateNouns(e.target.value);
        // Reset subsequent parts if changing the first verb
    });

    nounSelect.addEventListener('change', (e) => {
        const selectedVerb = verbSelect.value;
        if (selectedVerb && e.target.value) {
            populateParameters(`${selectedVerb}-${e.target.value}`);
        } else {
            parametersContainer.innerHTML = ''; // Clear params if noun is deselected
            updateGeneratedCommand();
        }
    });

    copyCommandButton.addEventListener('click', () => {
        navigator.clipboard.writeText(generatedCommandElement.textContent)
            .then(() => {
                copyCommandButton.textContent = '✅ Copied!';
                setTimeout(() => copyCommandButton.textContent = '📋 Copy Command', 2000);
            })
            .catch(err => console.error('Failed to copy: ', err));
    });

    // Placeholder for piping logic
    addPipeButton.addEventListener('click', () => {
        console.log("Add pipe clicked. Piping UI and logic to be implemented.");
        // Here you would add a new set of verb/noun/param selectors
        // and append " | " to the generated command.
        alert("Piping feature is under construction!");
    });

    exampleCards.forEach(card => {
        const button = card.querySelector('button');
        button.addEventListener('click', () => {
            const exampleId = card.dataset.exampleId;
            loadExampleCommand(exampleId);
        });
    });

    function loadExampleCommand(exampleId) {
        // This is a very basic example loader.
        // A real implementation would parse the command and set the UI elements.
        let cmd = "";
        switch(exampleId) {
            case 'file-ops':
                cmd = "Get-ChildItem -Recurse -File | Format-Table Name, Length";
                // For a full implementation:
                // verbSelect.value = "Get"; populateNouns("Get");
                // nounSelect.value = "ChildItem"; populateParameters("Get-ChildItem");
                // Check -Recurse, -File. Add pipe. Set Format-Table for pipe.
                break;
            case 'data-process':
                cmd = "Import-Csv -Path 'data.csv' | Where-Object -Property Name -EQ 'Value' | Select-Object -Property Name, Version";
                break;
            case 'system-mgmt':
                cmd = "Get-Process -Name 'chrome' | Stop-Process -Force";
                break;
            default:
                cmd = "Unknown example";
        }
        generatedCommandElement.textContent = cmd;
        copyCommandButton.disabled = false;
        alert(`Example loaded (display only):\n${cmd}\n\nFull UI population for examples is a future enhancement.`);
    }

    // --- Initialize ---
    initializeApp();
});