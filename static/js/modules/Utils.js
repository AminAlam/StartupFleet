export const ICONS = [
    '🚀', '🩺', '💊', '🏭', '💰', '⚖️', '💡', '🧪', '📈', '🤝', '🏗️', '🎓', '🚑', '📡', '⚓', '⭐',
    '📊', '🏛️', '💲', '📦', '🔧', '🧬', '🔬', '🏥', '🌍', '📢', '📝', '🛡️', '🎯', '🚢', '🗺️', '🕰️'
];

export const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F1948A'];

export class Utils {
    static generateId(prefix = 'id') {
        return prefix + '_' + Math.random().toString(36).substr(2, 9);
    }

    static dist(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    static clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
    
    static showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span style="color:#4fc3f7">ℹ</span> ${message}`;
        if (type === 'success') toast.innerHTML = `<span style="color:#66bb6a">✔</span> ${message}`;
        if (type === 'error') toast.innerHTML = `<span style="color:#ef5350">✖</span> ${message}`;
        
        container.appendChild(toast);
        setTimeout(() => { if(toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
    }

    static createTextTexture(text, color = '#333', fontSize = 40) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `bold ${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const w = Math.ceil(metrics.width) + 20;
        const h = Math.ceil(fontSize * 1.5);
        canvas.width = w;
        canvas.height = h;
        
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(text, w/2, h/2);
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        return { texture: tex, width: w, height: h, aspect: w/h };
    }
}
