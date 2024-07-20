// ==UserScript==
// @name         DefectDojo OpenProject Tooltip Integration
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Add tooltips to DefectDojo vulnerabilities with information from OpenProject
// @author       Your Name
// @match        https://demo.defectdojo.org/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    const openProjectUrl = 'http://localhost:8088/api/v3/projects/3/work_packages';
    const openProjectApiKey = '';

    // Function to fetch data using GM_xmlhttpRequest
    function fetchData(url, apiKey) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Authorization': apiKey
                },
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(response.statusText);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Parse OpenProject data
    function parseOpenProjectData(data) {
        return data._embedded.elements.map(task => {
            const findingUrlMatch = task.description.raw.match(/https:\/\/demo.defectdojo.org\/finding\/(\d+)/);
            return {
                id: task.id,
                status: task._links.status.title,
                assignee: task._links.assignee && task._links.assignee.title ? task._links.assignee.title : 'N/A',
                findingUrl: findingUrlMatch ? findingUrlMatch[0] : 'N/A'
            };
        });
    }

    // Function to create and add tooltips to checkboxes
    function createTooltips(data) {
        const checkboxes = document.querySelectorAll('.active_finding .noVis:first-child form input');

        checkboxes.forEach(checkbox => {
            if (checkbox.parentElement && checkbox.parentElement.parentElement) {
                checkbox.parentElement.parentElement.style.position = 'relative';

                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.display = 'none';
                tooltip.style.minWidth = '250px';  // Set a minimum width for the tooltip
                tooltip.style.maxWidth = '1000px';  // Set a maximum width for the tooltip
                tooltip.style.backgroundColor = 'rgba(51, 51, 51, 0.85)';  // Set background color with transparency
                tooltip.style.color = '#fff';
                tooltip.style.textAlign = 'left';   // Align text to the left
                tooltip.style.borderRadius = '6px';
                tooltip.style.padding = '10px';
                tooltip.style.zIndex = '10001';
                tooltip.style.top = '-50%';
                tooltip.style.left = '100%';
                tooltip.style.whiteSpace = 'normal';  // Allow text wrapping
                tooltip.style.wordWrap = 'break-word'; // Wrap long words

                const task = data.find(task => task.findingUrl.includes(`/finding/${checkbox.id}`));

                if (task) {
                    const link = document.createElement('a');
                    link.href = `http://localhost:8088/projects/demodojo/work_packages/${task.id}`;
                    link.target = '_blank';
                    link.innerText = `${task.id}`;
                    link.style.color = '#3fa5cc';  // Change link color to blue

                    tooltip.innerHTML = `ID: `;
                    tooltip.appendChild(link);
                    tooltip.innerHTML += `;<br>Status: ${task.status};<br>Assignee: ${task.assignee};`;

                    // Highlight the checkbox row based on task existence and assignee
                    if (task.assignee === 'N/A') {
                        checkbox.parentElement.parentElement.style.backgroundColor = 'lightgreen';
                    } else {
                        checkbox.parentElement.parentElement.style.backgroundColor = 'yellow';
                    }
                } else {
                    tooltip.innerHTML = "ID: N/A;<br>Status: N/A;<br>Assignee: N/A;";
                    checkbox.parentElement.parentElement.style.backgroundColor = 'lightcoral';
                }

                checkbox.parentElement.parentElement.appendChild(tooltip);

                checkbox.parentElement.parentElement.addEventListener('mouseover', () => {
                    tooltip.style.display = 'block';
                });

                checkbox.parentElement.parentElement.addEventListener('mouseout', () => {
                    tooltip.style.display = 'none';
                });

                console.log('Tooltip created for checkbox with ID:', checkbox.id);
            }
        });
    }

    // Main function to fetch data and add tooltips
    async function main() {
        try {
            const openProjectData = await fetchData(openProjectUrl, openProjectApiKey);
            const parsedOpenProjectData = parseOpenProjectData(openProjectData);
            console.log('Parsed OpenProject Data:', parsedOpenProjectData);

            createTooltips(parsedOpenProjectData);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    // Run the main function when the document is ready
    window.addEventListener('load', main);
})();
