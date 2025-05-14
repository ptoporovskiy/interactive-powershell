document.addEventListener('DOMContentLoaded', () => {
    console.log("Interactive PowerShell V4 Loaded!");

    // --- DOM Elements ---
    const verbList = document.getElementById('verb-list');
    const nounList = document.getElementById('noun-list');
    const parameterList = document.getElementById('parameter-list');

    const verbColumn = document.getElementById('verb-column');
    const nounColumn = document.getElementById('noun-column');
    const parameterColumn = document.getElementById('parameter-column');
    const pipingColumn = document.getElementById('piping-column');

    const generatedCommandElement = document.getElementById('sticky-generated-command');
    const copyCommandButton = document.getElementById('sticky-copy-command');
    const addPipeSegmentButton = document.getElementById('add-pipe-segment-button');

    const tooltipElement = document.getElementById('tooltip');
    const stickyCommandBarWrapper = document.querySelector('.sticky-command-bar-wrapper');
    const mainContainer = document.querySelector('.container'); // For aligning sticky bar

    // --- State ---
    let currentSelectedVerb = null;
    let currentSelectedNoun = null;
    let currentSelectedCmdlet = null;
    let currentParameters = {};

    let cmdletData = {};
    let parameterData = {};

    // --- Initialize ---
    async function initializeApp() {
        await loadData();
        populateVerbs();
        updateGeneratedCommand();
        // setupExampleLoaders(); // Removed
        adjustStickyBarPosition(); // Initial position
        window.addEventListener('resize', adjustStickyBarPosition); // Adjust on resize
        // setupBodyPaddingForStickyBar(); // Adjust body padding
    }

    // --- Data Loading --- (Same as before)
    async function loadData() {
        try {
            const [cmdletRes, paramRes] = await Promise.all([
                fetch('data/cmdlets.json'),
                fetch('data/parameters.json')
            ]);
            cmdletData = await cmdletRes.json();
            parameterData = await paramRes.json();
        } catch (error) {
            console.error("Failed to load data:", error);
            generatedCommandElement.textContent = "Error: Could not load command data.";
        }
    }
    
    // --- Tooltip Logic ---
    function showTooltip(text, event) {
        if (!text) return;
        tooltipElement.textContent = text;
        tooltipElement.style.left = `${event.clientX + 15}px`; // Offset from cursor
        tooltipElement.style.top = `${event.clientY + 15}px`;
        tooltipElement.classList.add('visible');
    }

    function hideTooltip() {
        tooltipElement.classList.remove('visible');
    }

    // --- UI Population (with tooltip event listeners) ---
    function getCmdletCategoryIcon(verb, noun) { /* ... same as before ... */
        const cmdletName = `${verb}-${noun}`;
        if (cmdletData.categories) {
            for (const categoryKey in cmdletData.categories) {
                const category = cmdletData.categories[categoryKey];
                if (category.cmdlets.includes(cmdletName)) {
                    return category.icon;
                }
            }
        }
        return cmdletData.categories?.Other?.icon || "▫️";
    }


    function populateVerbs() {
        verbList.innerHTML = '';
        if (!cmdletData.verbs) { /* ... */ return; }
        const verbs = Object.keys(cmdletData.verbs).sort();
        verbs.forEach(verb => {
            const li = document.createElement('li');
            li.dataset.value = verb;
            // ... (icon logic same as before) ...
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('item-icon');
            let verbIcon = "▫️";
            const typicalNoun = cmdletData.verbs[verb]?.[0];
            if (typicalNoun) verbIcon = getCmdletCategoryIcon(verb, typicalNoun);
            iconSpan.textContent = verbIcon;
            li.appendChild(iconSpan);
            li.appendChild(document.createTextNode(verb));

            li.addEventListener('click', () => handleVerbSelection(verb, li));
            li.addEventListener('mouseenter', (e) => {
                const desc = cmdletData.verbDescriptions?.[verb] || `The '${verb}' verb.`;
                showTooltip(desc, e);
            });
            li.addEventListener('mouseleave', hideTooltip);
            verbList.appendChild(li);
        });
    }

    function handleVerbSelection(verb, selectedLi) { /* ... same as before ... */
        verbList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        selectedLi.classList.add('selected');
        currentSelectedVerb = verb;
        currentSelectedNoun = null;
        currentSelectedCmdlet = null;
        currentParameters = {};
        populateNouns(verb);
        parameterList.innerHTML = '<li class="placeholder-item">Select a noun first</li>';
        nounColumn.classList.remove('disabled-column');
        parameterColumn.classList.add('disabled-column');
        pipingColumn.classList.add('disabled-column');
        addPipeSegmentButton.disabled = true;
        updateGeneratedCommand();
    }


    function populateNouns(selectedVerb) {
        nounList.innerHTML = '';
        if (!selectedVerb || !cmdletData.verbs[selectedVerb]) { /* ... */ return; }
        const nouns = cmdletData.verbs[selectedVerb].sort();
        nouns.forEach(noun => {
            const li = document.createElement('li');
            li.dataset.value = noun;
            // ... (icon logic same as before) ...
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('item-icon');
            iconSpan.textContent = getCmdletCategoryIcon(selectedVerb, noun);
            li.appendChild(iconSpan);
            li.appendChild(document.createTextNode(noun));

            li.addEventListener('click', () => handleNounSelection(noun, li));
            li.addEventListener('mouseenter', (e) => {
                const cmdletName = `${selectedVerb}-${noun}`;
                const desc = parameterData.cmdlets[cmdletName]?.description || `Cmdlet: ${cmdletName}`;
                showTooltip(desc, e);
            });
            li.addEventListener('mouseleave', hideTooltip);
            nounList.appendChild(li);
        });
    }
    
    function handleNounSelection(noun, selectedLi) { /* ... same as before ... */
        nounList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        selectedLi.classList.add('selected');
        currentSelectedNoun = noun;
        currentSelectedCmdlet = `${currentSelectedVerb}-${currentSelectedNoun}`;
        currentParameters = {};
        populateParameters(currentSelectedCmdlet);
        parameterColumn.classList.remove('disabled-column');
        pipingColumn.classList.remove('disabled-column');
        addPipeSegmentButton.disabled = false;
        updateGeneratedCommand();
    }


    function populateParameters(cmdletName) {
        parameterList.innerHTML = '';
        currentParameters = {};
        if (!cmdletName || !parameterData.cmdlets[cmdletName] || !parameterData.cmdlets[cmdletName].parameters) {
            parameterList.innerHTML = `<li class="placeholder-item">No parameters for ${cmdletName}.</li>`;
            updateGeneratedCommand(); return;
        }
        const params = parameterData.cmdlets[cmdletName].parameters;
        Object.entries(params).forEach(([paramName, paramDetails]) => {
            const li = document.createElement('li');
            // ... (li setup same as before) ...
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
            typeSpan.textContent = `(${paramDetails.type.replace('System.Management.Automation.', '')})`;
            label.appendChild(checkbox);
            label.appendChild(nameSpan);
            label.appendChild(typeSpan);
            li.appendChild(label);
            currentParameters[paramName] = { selected: false, value: '', type: paramDetails.type };
            let inputField = null; 
            if (paramDetails.type !== "SwitchParameter" && paramDetails.type !== "System.Management.Automation.SwitchParameter") {
                const input = document.createElement('input');
                input.type = 'text';
                // ... (input setup same as before) ...
                input.classList.add('parameter-input');
                input.placeholder = paramDetails.placeholder || `Enter ${paramDetails.type}`;
                input.dataset.paramName = paramName;
                li.appendChild(input);
                inputField = input; 
                input.addEventListener('input', (e) => {
                    currentParameters[paramName].value = e.target.value;
                    updateGeneratedCommand();
                });
            }
            
            li.addEventListener('click', (e) => { /* ... same as before ... */
                if (e.target !== inputField && e.target !== checkbox) { 
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            checkbox.addEventListener('change', (e) => { /* ... same as before ... */
                const isChecked = e.target.checked;
                currentParameters[paramName].selected = isChecked;
                li.classList.toggle('has-value-selected', isChecked && (paramDetails.type !== "SwitchParameter" && paramDetails.type !== "System.Management.Automation.SwitchParameter"));
                li.classList.toggle('selected', isChecked);
                updateGeneratedCommand();
            });

            li.addEventListener('mouseenter', (e) => {
                showTooltip(paramDetails.description || `Parameter: ${paramName}`, e);
            });
            li.addEventListener('mouseleave', hideTooltip);
            parameterList.appendChild(li);
        });
        updateGeneratedCommand();
    }

    // --- Command Logic --- (Same as before)
    function updateGeneratedCommand() { /* ... same as before ... */
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
                        if (value !== '') {
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
        // Adjust body padding for sticky bar after command updates (height might change)
        // setupBodyPaddingForStickyBar();
    }

    // --- Sticky Bar Positioning & Body Padding ---
    function adjustStickyBarPosition() {
        if (mainContainer && stickyCommandBarWrapper) {
            const containerRect = mainContainer.getBoundingClientRect();
            stickyCommandBarWrapper.style.left = `${containerRect.left}px`;
            stickyCommandBarWrapper.style.width = `${containerRect.width}px`;
        }
        // setupBodyPaddingForStickyBar(); // Also adjust padding on resize
    }

    // This function dynamically adjusts body padding to prevent content from being hidden by the sticky bar.
    // Could be further refined, e.g., using ResizeObserver on the sticky bar itself.
    // For now, using a static padding in CSS as fallback is simpler.
    // function setupBodyPaddingForStickyBar() {
    //     const barHeight = stickyCommandBarWrapper.offsetHeight;
    //     document.body.style.paddingBottom = `${barHeight + 20}px`; // 20px buffer
    // }


    // --- Event Listeners ---
    copyCommandButton.addEventListener('click', () => { /* ... same as before ... */
        if(generatedCommandElement.textContent === "Build your command above...") return;
        navigator.clipboard.writeText(generatedCommandElement.textContent)
            .then(() => {
                copyCommandButton.textContent = '✅ Copied!';
                setTimeout(() => copyCommandButton.textContent = '📋 Copy', 2000);
            })
            .catch(err => console.error('Failed to copy: ', err));
    });
    
    addPipeSegmentButton.addEventListener('click', () => {
        alert("Piping feature is under construction!");
    });

    // function setupExampleLoaders() { /* REMOVED */ }

    // --- Initialize ---
    initializeApp();
});