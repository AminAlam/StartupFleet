export class ParticleSystem {
    constructor() { this.particles = []; }
    spawn(x, y, type = 'cloud') {
        this.particles.push({
            x: x, y: y, type: type,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.2,
            life: 1.0, size: Math.random() * 20 + 10
        });
    }
    update() {
        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.type === 'cloud') { p.x += 0.2; if (p.x > 2000) p.x = -2000; }
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }
    draw(ctx, zoom) {
        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = 0.3; ctx.fillStyle = "#fff";
            if (p.type === 'cloud') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.arc(p.x + 15, p.y - 5, p.size * 1.2, 0, Math.PI*2);
                ctx.arc(p.x + 30, p.y, p.size * 0.8, 0, Math.PI*2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
}
