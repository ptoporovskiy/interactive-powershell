document.addEventListener('DOMContentLoaded', () => {
    console.log("Interactive PowerShell V2 Loaded!");

    // --- DOM Elements ---
    const verbList = document.getElementById('verb-list');
    const nounList = document.getElementById('noun-list');
    const parameterList = document.getElementById('parameter-list');

    const verbColumn = document.getElementById('verb-column');
    const nounColumn = document.getElementById('noun-column');
    const parameterColumn = document.getElementById('parameter-column');
    const pipingColumn = document.getElementById('piping-column');

    const generatedCommandElement = document.getElementById('generated-command');
    const copyCommandButton = document.getElementById('copy-command');
    const addPipeSegmentButton = document.getElementById('add-pipe-segment-button');
    // const exampleCards = document.querySelectorAll('.example-card button'); // Corrected selector

    // --- State for the current (first) command segment ---
    let currentSelectedVerb = null;
    let currentSelectedNoun = null;
    let currentSelectedCmdlet = null;
    let currentParameters = {}; // { paramName: { value: '...', type: 'String', selected: true }, ... }

    // --- Data ---
    let cmdletData = {};
    let parameterData = {};

    // --- Initialize ---
    async function initializeApp() {
        await loadData();
        populateVerbs();
        updateGeneratedCommand(); // Initial update
        setupExampleLoaders();
    }

    // --- Data Loading ---
    async function loadData() {
        try {
            const [cmdletRes, paramRes] = await Promise.all([
                fetch('data/cmdlets.json'),
                fetch('data/parameters.json')
            ]);
            cmdletData = await cmdletRes.json();
            parameterData = await paramRes.json();
            console.log("Data loaded:", { cmdletData, parameterData });
        } catch (error) {
            console.error("Failed to load data:", error);
            generatedCommandElement.textContent = "Error: Could not load command data.";
        }
    }

    // --- UI Population ---
    function getCmdletCategoryIcon(verb, noun) {
        const cmdletName = `${verb}-${noun}`;
        if (cmdletData.categories) {
            for (const categoryKey in cmdletData.categories) {
                const category = cmdletData.categories[categoryKey];
                if (category.cmdlets.includes(cmdletName)) {
                    return category.icon;
                }
            }
        }
        // Fallback for verbs if noun not yet selected or cmdlet not categorized
        if (cmdletData.categories) {
             for (const categoryKey in cmdletData.categories) {
                const category = cmdletData.categories[categoryKey];
                if (category.cmdlets.some(c => c.startsWith(verb + "-"))) { // Looser match for verb
                    // return category.icon; // Could be too broad
                }
            }
        }
        return cmdletData.categories?.Other?.icon || "▫️"; // Default icon
    }


    function populateVerbs() {
        verbList.innerHTML = ''; // Clear previous
        if (!cmdletData.verbs) {
            verbList.innerHTML = '<li class="placeholder-item">No verbs loaded</li>';
            return;
        }

        const verbs = Object.keys(cmdletData.verbs).sort();
        verbs.forEach(verb => {
            const li = document.createElement('li');
            li.dataset.value = verb;
            
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('item-icon');
            // For verbs, icon might be generic or based on common cmdlets for that verb
            let verbIcon = "▫️"; // Default
            if (cmdletData.categories) {
                 // Try to find a representative icon for the verb based on its nouns
                const typicalNoun = cmdletData.verbs[verb]?.[0];
                if (typicalNoun) verbIcon = getCmdletCategoryIcon(verb, typicalNoun);
            }
            iconSpan.textContent = verbIcon;

            li.appendChild(iconSpan);
            li.appendChild(document.createTextNode(verb));
            
            li.addEventListener('click', () => handleVerbSelection(verb, li));
            verbList.appendChild(li);
        });
    }

    function handleVerbSelection(verb, selectedLi) {
        // Visual selection
        verbList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        selectedLi.classList.add('selected');

        currentSelectedVerb = verb;
        currentSelectedNoun = null; // Reset noun
        currentSelectedCmdlet = null;
        currentParameters = {}; // Reset params

        populateNouns(verb);
        parameterList.innerHTML = '<li class="placeholder-item">Select a noun first</li>'; // Clear params
        
        nounColumn.classList.remove('disabled-column');
        parameterColumn.classList.add('disabled-column');
        pipingColumn.classList.add('disabled-column');
        addPipeSegmentButton.disabled = true;

        updateGeneratedCommand();
    }

    function populateNouns(selectedVerb) {
        nounList.innerHTML = ''; // Clear previous
        if (!selectedVerb || !cmdletData.verbs[selectedVerb]) {
            nounList.innerHTML = '<li class="placeholder-item">Select a verb first</li>';
            return;
        }

        const nouns = cmdletData.verbs[selectedVerb].sort();
        nouns.forEach(noun => {
            const li = document.createElement('li');
            li.dataset.value = noun;

            const iconSpan = document.createElement('span');
            iconSpan.classList.add('item-icon');
            iconSpan.textContent = getCmdletCategoryIcon(selectedVerb, noun);
            
            li.appendChild(iconSpan);
            li.appendChild(document.createTextNode(noun));

            li.addEventListener('click', () => handleNounSelection(noun, li));
            nounList.appendChild(li);
        });
    }

    function handleNounSelection(noun, selectedLi) {
        nounList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        selectedLi.classList.add('selected');

        currentSelectedNoun = noun;
        currentSelectedCmdlet = `${currentSelectedVerb}-${currentSelectedNoun}`;
        currentParameters = {}; // Reset params

        populateParameters(currentSelectedCmdlet);
        parameterColumn.classList.remove('disabled-column');
        pipingColumn.classList.remove('disabled-column');
        addPipeSegmentButton.disabled = false;

        updateGeneratedCommand();
    }

    function populateParameters(cmdletName) {
        parameterList.innerHTML = ''; // Clear previous
        currentParameters = {}; // Reset internal state

        if (!cmdletName || !parameterData.cmdlets[cmdletName] || !parameterData.cmdlets[cmdletName].parameters) {
            parameterList.innerHTML = `<li class="placeholder-item">No parameters for ${cmdletName}, or cmdlet not found.</li>`;
            updateGeneratedCommand();
            return;
        }

        const params = parameterData.cmdlets[cmdletName].parameters;
        Object.entries(params).forEach(([paramName, paramDetails]) => {
            const li = document.createElement('li');
            li.dataset.paramName = paramName;

            const label = document.createElement('label');
            label.classList.add('parameter-item-label');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('parameter-checkbox');
            checkbox.id = `param-check-${paramName}`;
            checkbox.dataset.paramName = paramName;

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('parameter-name');
            nameSpan.textContent = paramName;
            
            const typeSpan = document.createElement('span');
            typeSpan.classList.add('parameter-type');
            typeSpan.textContent = `(${paramDetails.type.replace('System.Management.Automation.', '')})`; // Shorten type

            label.appendChild(checkbox);
            label.appendChild(nameSpan);
            label.appendChild(typeSpan);
            li.appendChild(label);
            
            currentParameters[paramName] = { selected: false, value: '', type: paramDetails.type };

            if (paramDetails.type !== "SwitchParameter" && paramDetails.type !== "System.Management.Automation.SwitchParameter") {
                const input = document.createElement('input');
                input.type = 'text';
                input.classList.add('parameter-input');
                input.placeholder = paramDetails.placeholder || `Enter ${paramDetails.type}`;
                input.dataset.paramName = paramName;
                // input.disabled = true; // Input starts hidden by CSS, enabled by class
                li.appendChild(input);

                input.addEventListener('input', (e) => {
                    currentParameters[paramName].value = e.target.value;
                    updateGeneratedCommand();
                });
            }
            
            // Click on the entire list item toggles the checkbox
            li.addEventListener('click', (e) => {
                // Prevent toggling if click was directly on input field or checkbox itself
                if (e.target !== input && e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Manually trigger change event for checkbox
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });


            checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                currentParameters[paramName].selected = isChecked;
                li.classList.toggle('has-value-selected', isChecked && (paramDetails.type !== "SwitchParameter" && paramDetails.type !== "System.Management.Automation.SwitchParameter"));
                li.classList.toggle('selected', isChecked); // General selected style
                // if (input) input.disabled = !isChecked;
                updateGeneratedCommand();
            });

            parameterList.appendChild(li);
        });
        updateGeneratedCommand();
    }

    // --- Command Logic ---
    function updateGeneratedCommand() {
        let commandString = "";
        if (currentSelectedCmdlet) {
            commandString = currentSelectedCmdlet;
            const activeParams = [];
            for (const paramName in currentParameters) {
                const paramState = currentParameters[paramName];
                if (paramState.selected) {
                    const paramDetails = parameterData.cmdlets[currentSelectedCmdlet]?.parameters[paramName];
                    if (paramDetails.type === "SwitchParameter" || paramDetails.type === "System.Management.Automation.SwitchParameter") {
                        activeParams.push(`-${paramName}`);
                    } else {
                        let value = paramState.value.trim();
                        if (value === '' && paramDetails.type !== "SwitchParameter") {
                             // activeParams.push(`-${paramName} <value>`); // Indicate value needed
                             // For now, don't add param if value is empty and not a switch
                        } else {
                            if (value.includes(' ') && !((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
                                value = `'${value}'`;
                            }
                            activeParams.push(`-${paramName} ${value}`);
                        }
                    }
                }
            }
            if (activeParams.length > 0) {
                commandString += " " + activeParams.join(" ");
            }
        }

        if (commandString) {
            generatedCommandElement.textContent = commandString;
            copyCommandButton.disabled = false;
        } else {
            generatedCommandElement.textContent = "Build your command above...";
            copyCommandButton.disabled = true;
        }
    }

    // --- Event Listeners ---
    copyCommandButton.addEventListener('click', () => {
        if(generatedCommandElement.textContent === "Build your command above...") return;
        navigator.clipboard.writeText(generatedCommandElement.textContent)
            .then(() => {
                copyCommandButton.textContent = '✅ Copied!';
                setTimeout(() => copyCommandButton.textContent = '📋 Copy Command', 2000);
            })
            .catch(err => console.error('Failed to copy: ', err));
    });
    
    addPipeSegmentButton.addEventListener('click', () => {
        alert("Piping feature is under construction! This would add a new command segment builder.");
        // For a full implementation, this would involve:
        // 1. Storing the current commandString.
        // 2. Resetting currentSelectedVerb, Noun, Cmdlet, Parameters.
        // 3. Clearing/resetting the UI for Steps 1-3 for a *new* command.
        // 4. Appending " | " to the stored commandString and then building the new one.
        // 5. Displaying the full pipeline.
    });

    function setupExampleLoaders() {
        const exampleCards = document.querySelectorAll('.example-card');
        exampleCards.forEach(card => {
            const button = card.querySelector('button');
            button.addEventListener('click', () => {
                const exampleId = card.dataset.exampleId;
                const codeElement = card.querySelector('code');
                if (codeElement) {
                    generatedCommandElement.textContent = codeElement.textContent.trim();
                    copyCommandButton.disabled = false;
                    alert(`Example loaded into output (display only):\n${codeElement.textContent.trim()}\n\nFull UI population from examples is a future enhancement.`);
                    // To fully implement: parse command and set UI elements.
                }
            });
        });
    }

    // --- Initialize ---
    initializeApp();
});