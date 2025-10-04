class PolandGeographyApp {
    constructor() {
        this.map = null;
        this.data = null;
        this.layers = {};
        this.isQuizMode = false;
        this.currentQuizPoint = null;
        this.stats = { correct: 0, incorrect: 0 };

        this.layerConfig = [
            { key: 'skrajne_punkty', name: 'Skrajne punkty Polski', color: 'extreme', type: 'other' },
            { key: 'szczyty_wysokie', name: 'Szczyty gór wysokich', color: 'peaks', type: 'mountain' },
            { key: 'wzniesienia_nizu', name: 'Wzniesienia Niżu Polskiego', color: 'lowland-hills', type: 'lowland' },
            { key: 'gory', name: 'Góry', color: 'mountains', type: 'mountain' },
            { key: 'przedgorza_pogorza', name: 'Przedgórza i pogórza', color: 'foothills', type: 'mountain' },
            { key: 'wyzyny', name: 'Wyżyny', color: 'plateaus', type: 'plateau' },
            { key: 'kotliny_rowiny', name: 'Kotliny i równiny', color: 'basins', type: 'plateau' },
            { key: 'niziny', name: 'Niziny', color: 'lowlands', type: 'lowland' },
            { key: 'pojezierza', name: 'Pojezierza', color: 'lakelands', type: 'other' },
            { key: 'inne_krainy', name: 'Inne krainy fizycznogeograficzne', color: 'other-regions', type: 'other' },
            { key: 'rzeki', name: 'Rzeki', color: 'rivers', type: 'water' },
            { key: 'jeziora', name: 'Jeziora', color: 'lakes', type: 'water' }
        ];

        // expose instance globally so resize handler works
        window.app = this;

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.initMap();
            this.createLayers();
            this.setupEventListeners();
            this.updateUI();
        } catch (error) {
            console.error('Błąd inicjalizacji aplikacji:', error);
            this.showError('Błąd ładowania danych geograficznych');
        }
    }

    async loadData() {
        try {
            const response = await fetch('poland_geography_data.json');
            if (!response.ok) throw new Error('Failed to fetch data');
            this.data = await response.json();
            console.log('Dane załadowane, klucze:', Object.keys(this.data || {}));
        } catch (error) {
            console.error('Błąd ładowania danych:', error);
            throw error;
        }
    }

    initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) throw new Error('Element #map nie znaleziony w DOM');

        // Initialize the map centered on Poland
        this.map = L.map('map', {
            center: [51.9194, 19.1451],
            zoom: 6,
            zoomControl: true,
            scrollWheelZoom: true
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);


        // ensure correct rendering (Leaflet sometimes needs invalidateSize)
        setTimeout(() => {
            if (this.map && this.map.invalidateSize) this.map.invalidateSize();
        }, 200);
    }

    createLayers() {
        // Always create an entry in this.layers for every config key (even when brak danych)
        this.layerConfig.forEach(config => {
            const layerData = this.data && this.data[config.key] ? this.data[config.key] : null;
            const layerGroup = L.layerGroup();

            if (layerData && Array.isArray(layerData)) {
                layerData.forEach(item => {

                    const coords = (item.lat && item.lng) ? [item.lat, item.lng] : null;
                    if (!coords) return;

                    const marker = this.createCustomMarker(
                        coords,
                        config.color,
                        item.name,
                        config.name,
                        item.description || ''
                    );

                    marker.addTo(layerGroup);
                });
            } else {
                console.warn(`Brak danych dla warstwy: ${config.key}`);
            }

            this.layers[config.key] = {
                layer: layerGroup,
                visible: false,
                config: config,
                count: Array.isArray(layerData) ? layerData.length : 0
            };
        });

        console.log('Utworzone warstwy:', Object.keys(this.layers));
        this.createLayerButtons();
    }

    createCustomMarker(coords, color, name, category, description) {
        const marker = L.circleMarker([coords[0], coords[1]], {
            radius: 8,
            fillColor: this.getMarkerColor(color),
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            className: `custom-marker marker-${color}`
        });

        marker.bindTooltip(name, { permanent: false, direction: 'top', className: 'custom-tooltip' });

        marker.on('click', () => {
            this.handleMarkerClick(name, category, description, coords);
        });

        return marker;
    }

    getMarkerColor(colorKey) {
        const colors = {
            'extreme': '#FF5459',
            'peaks': '#5D878F',
            'lowland-hills': '#B4413C',
            'mountains': '#13343B',
            'foothills': '#964325',
            'plateaus': '#FFC185',
            'basins': '#ECEBD5',
            'lowlands': '#944454',
            'lakelands': '#1FB8CD',
            'other-regions': '#D2BA4C',
            'rivers': '#0e2fc2ff',
            'lakes': '#0ec991ff'
        };
        return colors[colorKey] || '#666666';
    }

    createLayerButtons() {
        const container = document.getElementById('layerButtons');
        if (!container) {
            console.warn('Nie znaleziono kontenera #layerButtons - przyciski warstw nie zostaną wygenerowane.');
            return;
        }
        container.innerHTML = '';

        this.layerConfig.forEach(config => {
            const layerInfo = this.layers[config.key];
            if (!layerInfo) {
                console.warn('Brak entry w this.layers dla', config.key);
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `layer-btn layer-btn--${config.type}`;
            button.setAttribute('data-layer-key', config.key);
            button.innerHTML = `
                <span class="layer-name">${config.name}</span>
                <span class="layer-count">(${layerInfo.count})</span>
            `;

            button.addEventListener('click', () => {
                this.toggleLayer(config.key);
            });

            container.appendChild(button);
        });
    }

    toggleLayer(layerKey) {
        const layerInfo = this.layers[layerKey];
        if (!layerInfo) return;

        if (layerInfo.visible) {
            this.map.removeLayer(layerInfo.layer);
            layerInfo.visible = false;
        } else {
            layerInfo.layer.addTo(this.map);
            layerInfo.visible = true;
        }

        this.updateLayerButton(layerKey);
    }

    updateLayerButton(layerKey) {
        const layerInfo = this.layers[layerKey];
        if (!layerInfo) return;

        const button = document.querySelector(`.layer-btn[data-layer-key="${layerKey}"]`);
        if (!button) return;

        if (layerInfo.visible) button.classList.add('active');
        else button.classList.remove('active');

        const countEl = button.querySelector('.layer-count');
        if (countEl) countEl.textContent = `(${layerInfo.count})`;
    }

    showAllLayers() {
        Object.keys(this.layers).forEach(key => {
            if (!this.layers[key].visible) this.toggleLayer(key);
        });
    }

    hideAllLayers() {
        Object.keys(this.layers).forEach(key => {
            if (this.layers[key].visible) this.toggleLayer(key);
        });
    }

    handleMarkerClick(name, category, description, coords) {
        if (this.isQuizMode) this.startQuiz(name, category, description);
        else this.showInfo(name, category, description);
    }

    startQuiz(correctAnswer, category, description) {
        this.currentQuizPoint = { correctAnswer, category, description };
        const modal = document.getElementById('quizModal');
        const title = document.getElementById('quizTitle');
        const categoryEl = document.getElementById('quizCategory');
        const input = document.getElementById('quizInput');
        const result = document.getElementById('quizResult');

        title.textContent = 'Jak nazywa się ten obiekt?';
        categoryEl.textContent = `Kategoria: ${category}`;
        input.value = '';
        result.classList.add('hidden');

        modal.classList.remove('hidden');
        input.focus();
    }

    submitAnswer() {
        const input = document.getElementById('quizInput');
        if (!this.currentQuizPoint) return;
        const userAnswer = (input.value || '').trim().toLowerCase();
        const correctAnswer = this.currentQuizPoint.correctAnswer.toLowerCase();

        const isCorrect = userAnswer === correctAnswer || this.fuzzyMatch(userAnswer, correctAnswer);

        this.showQuizResult(isCorrect);
        this.updateStats(isCorrect);
    }

    fuzzyMatch(input, target) {
        const normalize = str => str
            .toLowerCase()
            .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
            .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
            .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
            .replace(/[^a-z0-9\s]/g, '')
            .trim();

        const normalizedInput = normalize(input);
        const normalizedTarget = normalize(target);

        return normalizedInput === normalizedTarget ||
               normalizedTarget.includes(normalizedInput) ||
               normalizedInput.includes(normalizedTarget);
    }

    showQuizResult(isCorrect) {
        const result = document.getElementById('quizResult');
        const message = document.getElementById('resultMessage');
        const correctAnswer = document.getElementById('correctAnswer');

        result.classList.remove('hidden', 'correct', 'incorrect');

        if (isCorrect) {
            result.classList.add('correct');
            message.textContent = '✓ Poprawna odpowiedź!';
            correctAnswer.textContent = '';
        } else {
            result.classList.add('incorrect');
            message.textContent = '✗ Niepoprawna odpowiedź';
            correctAnswer.textContent = `Prawidłowa odpowiedź: ${this.currentQuizPoint.correctAnswer}`;
        }

        setTimeout(() => {
            const modal = document.getElementById('quizModal');
            if (modal) modal.classList.add('hidden');
        }, 2000);
    }

    updateStats(isCorrect) {
        if (isCorrect) this.stats.correct++;
        else this.stats.incorrect++;
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const correctEl = document.getElementById('correctCount');
        const incorrectEl = document.getElementById('incorrectCount');
        const accuracyEl = document.getElementById('accuracy');

        if (correctEl) correctEl.textContent = this.stats.correct;
        if (incorrectEl) incorrectEl.textContent = this.stats.incorrect;

        const total = this.stats.correct + this.stats.incorrect;
        const accuracy = total > 0 ? Math.round((this.stats.correct / total) * 100) : 0;
        if (accuracyEl) accuracyEl.textContent = accuracy + '%';
    }

    resetStats() {
        this.stats.correct = 0;
        this.stats.incorrect = 0;
        this.updateStatsDisplay();
    }

    showInfo(name, category, description) {
        const popup = document.getElementById('infoPopup');
        const title = document.getElementById('popupTitle');
        const categoryEl = document.getElementById('popupCategory');
        const descriptionEl = document.getElementById('popupDescription');

        if (!popup) return;
        if (title) title.textContent = name;
        if (categoryEl) categoryEl.textContent = `Kategoria: ${category}`;
        if (descriptionEl) descriptionEl.textContent = description || 'Brak dodatkowego opisu.';

        popup.classList.remove('hidden');
    }

    randomQuiz() {
        const allVisiblePoints = [];

        Object.keys(this.layers).forEach(layerKey => {
            const layerInfo = this.layers[layerKey];
            if (layerInfo.visible) {
                const layerData = this.data[layerKey] || [];
                layerData.forEach(item => {
                    allVisiblePoints.push({
                        name: item.name,
                        category: layerInfo.config.name,
                        description: item.description || ''
                    });
                });
            }
        });

        if (allVisiblePoints.length === 0) {
            alert('Włącz przynajmniej jedną warstwę, aby rozpocząć quiz!');
            return;
        }

        const randomPoint = allVisiblePoints[Math.floor(Math.random() * allVisiblePoints.length)];
        this.startQuiz(randomPoint.name, randomPoint.category, randomPoint.description);
    }

    toggleMode() {
        this.isQuizMode = !this.isQuizMode;
        this.updateUI();
    }

    updateUI() {
        const toggle = document.getElementById('modeToggle');
        const label = document.getElementById('modeLabel');

        if (toggle) toggle.checked = this.isQuizMode;
        if (label) label.textContent = this.isQuizMode ? 'Tryb quiz' : 'Tryb nauki';
    }

    setupEventListeners() {
        const modeToggle = document.getElementById('modeToggle');
        if (modeToggle) modeToggle.addEventListener('change', () => this.toggleMode());

        const showAllBtn = document.getElementById('showAllBtn');
        if (showAllBtn) showAllBtn.addEventListener('click', () => this.showAllLayers());

        const hideAllBtn = document.getElementById('hideAllBtn');
        if (hideAllBtn) hideAllBtn.addEventListener('click', () => this.hideAllLayers());

        const randomQuizBtn = document.getElementById('randomQuizBtn');
        if (randomQuizBtn) randomQuizBtn.addEventListener('click', () => this.randomQuiz());

        const submitAnswerBtn = document.getElementById('submitAnswer');
        if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', () => this.submitAnswer());

        const cancelQuizBtn = document.getElementById('cancelQuiz');
        if (cancelQuizBtn) cancelQuizBtn.addEventListener('click', () => {
            const modal = document.getElementById('quizModal');
            if (modal) modal.classList.add('hidden');
        });

        const resetStatsBtn = document.getElementById('resetStatsBtn');
        if (resetStatsBtn) resetStatsBtn.addEventListener('click', () => this.resetStats());

        const closePopupBtn = document.getElementById('closePopup');
        if (closePopupBtn) closePopupBtn.addEventListener('click', () => {
            const popup = document.getElementById('infoPopup');
            if (popup) popup.classList.add('hidden');
        });

        const quizInput = document.getElementById('quizInput');
        if (quizInput) {
            quizInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.submitAnswer();
            });
        }

        const quizModal = document.getElementById('quizModal');
        if (quizModal) {
            quizModal.addEventListener('click', (e) => {
                if (e.target.id === 'quizModal') quizModal.classList.add('hidden');
            });
        }

        // Close info popup when clicking outside
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('infoPopup');
            if (popup && !popup.contains(e.target) && !popup.classList.contains('hidden')) {
                popup.classList.add('hidden');
            }
        });
    }

    showError(message) {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;
        mapContainer.innerHTML = `
            <div class="loading">
                <p>⚠️ ${message}</p>
                <p style="font-size: var(--font-size-sm); margin-top: var(--space-8);">
                    Spróbuj odświeżyć stronę.
                </p>
            </div>
        `;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // instancja zostanie zapisana w window.app wewnątrz konstruktora
    new PolandGeographyApp();
});

// Handle window resize for responsive map
window.addEventListener('resize', () => {
    setTimeout(() => {
        if (window.app && window.app.map) {
            window.app.map.invalidateSize();
        }
    }, 100);
});
