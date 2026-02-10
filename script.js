let allArticles = [];

// 1. Chargement initial
function init() {
    db.ref('articles').on('value', (snapshot) => {
        const data = snapshot.val();
        allArticles = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        render(allArticles.reverse());
    });
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker actif !'))
            .catch(err => console.log('Erreur SW:', err));
    });
}

// 2. Affichage
function render(articles) {
    const container = document.getElementById('app-container');
    container.innerHTML = articles.map(post => `
        <article class="post-card">
            <img src="${post.image}" alt="${post.title}">
            <div class="post-content">
                <small style="color:var(--accent)">${post.tag}</small>
                <h2>${post.title}</h2>
                <p>${post.content}</p>
                <div class="post-actions" style="margin-top:20px; display:flex; gap:15px;">
                    <button onclick="like('${post.id}', ${post.likes})" style="background:none; border:1px solid #e74c3c; color:#e74c3c; cursor:pointer; padding:5px 10px; border-radius:5px;"><i class="fas fa-heart"></i> ${post.likes || 0}</button>
                    <button onclick="speak('${post.id}')" style="background:none; border:1px solid #ddd; color:#ddd; cursor:pointer; padding:5px 10px; border-radius:5px;"><i class="fas fa-volume-up"></i> Lire</button>
                </div>
            </div>
        </article>
    `).join('');
}

// 3. Bouton Histoire
const modal = document.getElementById('userModal');
document.getElementById('contactModalBtn').onclick = () => modal.style.display = "block";
document.querySelector('.close-modal').onclick = () => modal.style.display = "none";
window.onclick = (event) => { if (event.target == modal) modal.style.display = "none"; };

// 4. Recherche
document.getElementById('searchInput').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allArticles.filter(a => a.title.toLowerCase().includes(term) || a.tag.toLowerCase().includes(term));
    render(filtered);
};

// 5. Admin & Publication
document.getElementById('logoAdmin').onclick = () => {
    if(prompt("Code d'accès :") === "2026") {
        document.getElementById('adminPanel').style.display = "block";
        document.getElementById('adminPanel').scrollIntoView({behavior: "smooth"});
    }
};

document.getElementById('publishBtn').onclick = () => {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    if(title && content) {
        db.ref('articles').push({
            title, content,
            tag: document.getElementById('postTag').value || "Analyse",
            image: document.getElementById('postImage').value || "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
            likes: 0
        }).then(() => {
            alert("Rapport publié.");
            document.getElementById('adminPanel').style.display = "none";
        });
    }
};

// 6. Messages
window.sendVisitorMessage = () => {
    const text = document.getElementById('visitorMsg').value;
    if(text) {
        db.ref('messages').push({ text, date: new Date().toLocaleString() })
        .then(() => {
            alert("Message transmis.");
            modal.style.display = "none";
            document.getElementById('visitorMsg').value = "";
        });
    }
};

window.switchTab = (tab) => {
    document.getElementById('tab-publier').style.display = tab === 'publier' ? 'block' : 'none';
    document.getElementById('tab-inbox').style.display = tab === 'inbox' ? 'block' : 'none';
    document.getElementById('btn-pub').classList.toggle('active', tab === 'publier');
    document.getElementById('btn-inbox').classList.toggle('active', tab === 'inbox');
    if(tab === 'inbox') loadInbox();
};

function loadInbox() {
    db.ref('messages').on('value', (snapshot) => {
        const data = snapshot.val();
        const container = document.getElementById('messages-container');
        container.innerHTML = data ? Object.values(data).reverse().map(m => `
            <div style="background:#333; padding:15px; margin-bottom:10px; border-radius:5px; border-left:4px solid var(--accent)">
                <small>${m.date}</small>
                <p>${m.text}</p>
            </div>
        `).join('') : "Aucun message.";
    });
}

// Audio
window.speak = (id) => {
    const article = allArticles.find(a => a.id === id);
    const msg = new SpeechSynthesisUtterance(article.content);
    msg.pitch = 0.8;
    window.speechSynthesis.speak(msg);
};

init();

let currentAudio = null;
let currentPlayingId = null;

// RENDER mis à jour avec Audio, Like et Commentaires
// RENDER avec détection de longueur de texte
function render(articles) {
    const container = document.getElementById('app-container');
    container.innerHTML = articles.map(post => {
        const isLongText = post.content.split('\n').length > 3 || post.content.length > 200;
        
        return `
        <article class="post-card">
            <img src="${post.image}">
            <div class="post-content">
                <small style="color:var(--accent)">${post.tag}</small>
                <h2>${post.title}</h2>
                
                <div id="desc-${post.id}" class="post-description">
                    <p>${post.content}</p>
                </div>
                
                ${isLongText ? `<button onclick="toggleReadMore('${post.id}')" id="btn-more-${post.id}" class="btn-more">Voir plus...</button>` : ''}
                
                <div class="post-actions" style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="handleLike('${post.id}', ${post.likes || 0})" class="btn-like">
                        <i class="fas fa-heart"></i> ${post.likes || 0}
                    </button>
                    ${post.audio ? `<button onclick="toggleAudio('${post.id}', '${post.audio}')" id="btn-audio-${post.id}" class="btn-audio"><i class="fas fa-play"></i> Écouter</button>` : ''}
                    <button onclick="toggleComments('${post.id}')" style="background:none; border:1px solid #555; color:white;"><i class="fas fa-comment"></i></button>
                     <button onclick="shareSocial('${post.id}', '${post.title.replace(/'/g, "\\'")}')" class="btn-share">
                     <i class="fas fa-share-alt"></i> Partager</button>
                </div>
       

                <div id="comments-${post.id}" class="comment-section" style="display:none;">
                    <div id="list-${post.id}" class="comment-list"></div>
                    <div class="comment-inputs" style="margin-top:10px;">
                        <input type="text" id="name-${post.id}" placeholder="Votre nom">
                        <textarea id="input-${post.id}" placeholder="Votre commentaire..." style="width:100%; background:#333; border:1px solid #444; color:white; margin-bottom:5px;"></textarea>
                        <button onclick="addComment('${post.id}')" style="background:var(--accent); border:none; color:white; width:100%; padding:8px; cursor:pointer;">Poster</button>
                    </div>
                </div>
            </div>
        </article>
    `}).join('');

    // LOGIQUE DE PARTAGE NATIVE
window.shareArticle = (title, id) => {
    const url = window.location.origin + window.location.pathname + "#" + id;
    if (navigator.share) {
        navigator.share({
            title: title,
            text: "Découvrez cette analyse sur L'Odyssée Cognitive",
            url: url
        }).catch(err => console.log("Erreur de partage:", err));
    } else {
        navigator.clipboard.writeText(url);
        alert("Lien de l'article copié !");
    }
};
}

// Fonction VOIR PLUS
window.toggleReadMore = (id) => {
    const desc = document.getElementById(`desc-${id}`);
    const btn = document.getElementById(`btn-more-${id}`);
    if (desc.classList.contains('expanded')) {
        desc.classList.remove('expanded');
        btn.innerText = "Voir plus...";
    } else {
        desc.classList.add('expanded');
        btn.innerText = "Réduire";
    }
};

// AJOUT COMMENTAIRE avec NOM
window.addComment = (id) => {
    const nameInput = document.getElementById(`name-${id}`);
    const textInput = document.getElementById(`input-${id}`);
    
    if (textInput.value) {
        db.ref(`articles/${id}/comments`).push({
            author: nameInput.value || "Anonyme",
            text: textInput.value,
            date: new Date().toLocaleDateString()
        });
        textInput.value = "";
        nameInput.value = "";
    }
};

// Chargement des commentaires mis à jour
function loadComments(id) {
    db.ref(`articles/${id}/comments`).on('value', (snapshot) => {
        const data = snapshot.val();
        const list = document.getElementById(`list-${id}`);
        list.innerHTML = data ? Object.values(data).map(c => `
            <div class="comment-item">
                <strong style="color:var(--accent)">${c.author}:</strong> 
                <span style="font-size:0.9rem;">${c.text}</span>
            </div>
        `).join('') : "Soyez le premier à commenter.";
    });
}

// GESTION AUDIO (PLAY/PAUSE)
window.toggleAudio = (id, url) => {
    const btn = document.getElementById(`btn-audio-${id}`);
    
    if (currentPlayingId === id && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        } else {
            currentAudio.pause();
            btn.innerHTML = '<i class="fas fa-play"></i> Reprendre';
        }
    } else {
        if (currentAudio) currentAudio.pause();
        currentAudio = new Audio(url);
        currentAudio.play();
        currentPlayingId = id;
        btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        
        currentAudio.onended = () => {
            btn.innerHTML = '<i class="fas fa-play"></i> Écouter';
            currentPlayingId = null;
        };
    }
};

// GESTION LIKES
window.handleLike = (id, currentLikes) => {
    const hasLiked = localStorage.getItem(`liked_${id}`);
    
    if (hasLiked) {
        alert("Vous avez déjà aimé cette analyse.");
    } else {
        db.ref(`articles/${id}`).update({ 
            likes: currentLikes + 1 
        }).then(() => {
            localStorage.setItem(`liked_${id}`, true);
        });
    }
};

// GESTION COMMENTAIRES
window.toggleComments = (id) => {
    const section = document.getElementById(`comments-${id}`);
    const isVisible = section.style.display === "block";
    section.style.display = isVisible ? "none" : "block";
    if (!isVisible) loadComments(id);
};

window.addComment = (id) => {
    const input = document.getElementById(`input-${id}`);
    if (input.value) {
        db.ref(`articles/${id}/comments`).push({
            text: input.value,
            date: new Date().toLocaleDateString()
        });
        input.value = "";
    }
};

function loadComments(id) {
    db.ref(`articles/${id}/comments`).on('value', (snapshot) => {
        const data = snapshot.val();
        const list = document.getElementById(`list-${id}`);
        list.innerHTML = data ? Object.values(data).map(c => `
            <div class="comment-item"><strong>Anonyme:</strong> ${c.text}</div>
        `).join('') : "Aucun commentaire.";
    });
}

// Fonction pour vider tout le blog
window.clearBlog = () => {
    const confirmation = confirm("ATTENTION : Cette action supprimera TOUS les articles définitivement. Continuer ?");
    if (confirmation) {
        const secondeConfirmation = prompt("Tapez 'SUPPRIMER' pour confirmer la destruction totale.");
        if (secondeConfirmation === "SUPPRIMER") {
            db.ref('articles').set(null) // Efface la branche articles dans Firebase
            .then(() => {
                alert("Le blog a été vidé avec succès.");
            })
            .catch(error => {
                alert("Erreur lors de la suppression : " + error.message);
            });
        }
    }
};

// 1. LE TRI (Plus récent en premier)
function loadArticles() {
    db.ref('articles').orderByChild('timestamp').on('value', (snapshot) => {
        const data = snapshot.val();
        const articles = [];
        snapshot.forEach(child => {
            articles.push({ id: child.key, ...child.val() });
        });
        // On inverse pour avoir le plus récent en haut
        render(articles.reverse()); 
    });
}

// 2. LE PARTAGE (Utilise l'API native du téléphone)
window.shareSocial = (id, title) => {
    const url = window.location.origin + window.location.pathname + "#" + id;
    const text = encodeURIComponent("Découvrez cette analyse : " + title);
    
    // Création des liens de partage
    const whatsapp = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    const facebook = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    const twitter = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;

    // On affiche une petite fenêtre personnalisée (ou tu peux utiliser un modal)
    const shareBox = `
        <div class="share-overlay" onclick="this.remove()">
            <div class="share-menu" onclick="event.stopPropagation()">
                <h3>Partager via</h3>
                <div class="share-icons">
                    <a href="${whatsapp}" target="_blank" class="s-icon wa"><i class="fab fa-whatsapp"></i></a>
                    <a href="${facebook}" target="_blank" class="s-icon fb"><i class="fab fa-facebook"></i></a>
                    <a href="${twitter}" target="_blank" class="s-icon tw"><i class="fab fa-twitter"></i></a>
                    <button onclick="copyToClipboard('${url}')" class="s-icon cp"><i class="fas fa-link"></i></button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', shareBox);
};

window.copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    alert("Lien copié dans le presse-papier !");
};

// 3. SYSTÈME DE NOTIFICATION (Simulé pour l'App)
// Pour une vraie app installée, on utilise l'API Notification
document.getElementById('notifBtn').onclick = () => {
    if (!("Notification" in window)) {
        alert("Ce navigateur ne supporte pas les notifications.");
    } else {
        Notification.requestPermission();
    }
};

// Modification de la fonction de publication pour inclure le timestamp et la notif
document.getElementById('publishBtn').onclick = () => {
    const title = document.getElementById('postTitle').value;
    const sendPush = document.getElementById('sendPush').checked;
    
    const newPost = {
        title: title,
        content: document.getElementById('postContent').value,
        tag: document.getElementById('postTag').value || "Analyse",
        image: document.getElementById('postImage').value,
        likes: 0,
        timestamp: Date.now() // Crucial pour le tri
    };

    db.ref('articles').push(newPost).then(() => {
        if (sendPush && Notification.permission === "granted") {
            new Notification("Nouvel article : " + title);
        }
        alert("Propulsion réussie !");
    });
};

document.getElementById('notifBtn').onclick = () => {
    // On demande la permission
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            new Notification("L'Odyssée Cognitive", {
                body: "Notifications activées ! Vous serez alerté des prochaines analyses.",
                icon: "https://votre-logo.png"
            });
        } else {
            alert("Vous avez refusé les notifications. Vous pouvez changer cela dans les paramètres de votre navigateur.");
        }
    });
};