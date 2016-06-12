interface Window {
   mozRequestAnimationFrame(callback: FrameRequestCallback): number;
   oRequestAnimationFrame(callback: FrameRequestCallback): number;
   msRequestAnimationFrame(callback: FrameRequestCallback): number;
}

module ceviwalk {
   // ヘルパーがグローバルに漏れないように定義しなおし
   function __extends(d: any, b: any): any {
      for (var p in b) {
         if (b.hasOwnProperty(p)) {
            d[p] = b[p];
         }
      }
      function __() { this.constructor = d; }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
   }

   abstract class Walker {
      // 位置
      public x: number = 0;
      public y: number = 0;

      // 移動ベクトル
      protected vx: number = 0;
      protected vy: number = 0;
      protected vlen: number = 0;

      // 加速と減速
      public accel: number = 1;

      // 回転方向と速さ
      set angle(angle: number) {
         this.angle_ = angle;
         const a = angle / 180 * Math.PI;
         this.rcos = Math.cos(a);
         this.rsin = Math.sin(a);
      }
      get angle(): number {
         return this.angle_;
      }
      private angle_: number = 0;
      private rcos: number = Math.cos(0);
      private rsin: number = Math.sin(0);

      // 現在の動作名と経過フレーム数
      get motionId(): string {
         return this.motionId_;
      }
      set motionId(v: string) {
         this.motionId_ = v;
         this.motionFrames = -1;
      }
      private motionId_: string = 'default';
      private motionFrames: number = -1;

      // 移動距離（アニメーション速度計算用）
      private moved: number = 0;
      // アニメーションフレーム番号
      private animeFrame: number = 0;
      // 現在の描画内容
      private animeId: number = 0;

      public incrementAnimeFrame(): void {
         this.animeFrame = (this.animeFrame + 1) % this.animeFrames;
      }

      private e: HTMLCanvasElement;
      get elem(): HTMLCanvasElement {
         return this.e;
      };

      public constructor(
         private imageSource: HTMLImageElement,
         protected width: number,
         protected height: number,
         private animeFrames: number,
         private animeSpeed: number,
         private charId: number
      ) {
         const e = document.createElement('canvas');
         e.width = width;
         e.height = height;
         e.style.position = 'absolute';
         e.style.pointerEvents = 'none'; // マウスの邪魔をしない(IE9-10非対応)
         this.e = e;
         this.updateImage();
      }

      public updateVector(vx: number, vy: number): void {
         this.vx = vx;
         this.vy = vy;
         this.vlen = Math.sqrt(vx * vx + vy * vy);
      }

      public process(screenWidth: number, screenHeight: number): void {
         this.processMotion(++this.motionFrames);

         // 画面外にいる場合は強制的に連れ戻す
         if (this.x < 0) {
            this.x = 0;
         } else if (screenWidth - this.width < this.x) {
            this.x = screenWidth - this.width;
         }
         if (this.y < 0) {
            this.y = 0;
         } else if (screenHeight - this.height < this.y) {
            this.y = screenHeight - this.height;
         }

         // 回転を反映
         const ovx = this.vx, ovy = this.vy;
         this.vx = ovx * this.rcos - ovy * this.rsin;
         this.vy = ovx * this.rsin + ovy * this.rcos;

         // 加速と減速を反映
         this.vx *= this.accel;
         this.vy *= this.accel;
         this.vlen *= this.accel;

         // 次の移動で画面外に出てしまうなら向きを変更する
         const x = this.x + this.vx, y = this.y + this.vy;
         if (0 > x || x > screenWidth - this.width) {
            this.vx = -this.vx;
            this.angle = -this.angle_ * 0.5;
         }
         if (0 > y || y > screenHeight - this.height) {
            this.vy = -this.vy;
            this.angle = -this.angle_ * 0.5;
         }

         this.x += this.vx;
         this.y += this.vy;

         // 移動距離に応じてアニメーションを進める
         this.moved += this.vlen;
         if (this.moved >= this.animeSpeed) {
            const n = Math.floor(this.moved / this.animeSpeed);
            this.animeFrame = (this.animeFrame + n) % this.animeFrames;
            this.moved -= n * this.animeSpeed;
         }

         this.updateImage();

         const es = this.e.style;
         es.left = Math.floor(this.x) + 'px';
         es.top = Math.floor(this.y) + 'px';
         es.zIndex = Math.floor(10000 + this.y).toString();
      }

      protected abstract processMotion(frames: number): void;

      private updateImage(): void {
         const dir = (Math.atan2(this.vy, this.vx) * 180 / Math.PI + 360) % 360;
         let directionId: number;
         if (45 <= dir && dir < 135) {
            directionId = 1;
         } else if (135 <= dir && dir < 225) {
            directionId = 0;
         } else if (225 <= dir && dir < 315) {
            directionId = 3;
         } else {
            directionId = 2;
         }

         const x = this.charId * 4 + directionId, y = this.animeFrame;
         const animeId = x * 10000 + y;
         if (this.animeId === animeId) {
            return;
         }

         const ctx = this.e.getContext('2d'), w = this.width, h = this.height;
         ctx.clearRect(0, 0, w, h);
         ctx.drawImage(this.imageSource, x * w, y * h, w, h, 0, 0, w, h);
         this.animeId = animeId;
      }
   }

   class Sasara extends Walker {
      public tsudumi: Tsudumi;

      protected processMotion(frames: number): void {
         switch (this.motionId) {
            case 'default':
               // つづみが近くに居て、縦か横のずれが小さいならコミュニケーションを開始する
               // 判定も16フレームに1回しか行わない
               if ((frames & 0x0f) === 0) {
                  const dx = this.tsudumi.x - this.x, dy = this.tsudumi.y - this.y;
                  const dlen = Math.sqrt(dx * dx + dy * dy);
                  if (this.width < dlen && dlen < this.width * 4 && (Math.abs(dx) < this.width * 0.5 || Math.abs(dy) < this.height * 0.5)) {
                     this.motionId = 'communicate-tsudumi';
                     this.angle = 0;
                     // 本当は動かないようにしたいが、向き自体を移動ベクトルを元に判定しているので、とても小さい値でお茶を濁す
                     this.updateVector(dx / dlen * 0.0001, dy / dlen * 0.0001);
                     this.tsudumi.motionId = 'communicate-sasara';
                     this.tsudumi.angle = 0;
                     this.tsudumi.updateVector(-this.vx, -this.vy);
                     break;
                  }
                  if (frames > 400 && Math.random() > 0.99) {
                     switch (Math.random() * 2 | 0) {
                        case 0:
                           this.motionId = 'tsudumi-homing';
                           this.accel = 1.01;
                           break;
                        case 1:
                           this.motionId = 'turn';
                           this.angle = Math.random() > 0.5 ? 0.75 : -0.75;
                           break;
                     }
                     break;
                  }
               }
               break;
            case 'tsudumi-homing': // つづみ追尾モード
               if (this.vlen > 1) {
                  this.accel = 1;
               }
               if ((frames & 0x0f) === 0) {
                  const dx = this.tsudumi.x - this.x, dy = this.tsudumi.y - this.y;
                  const dlen = Math.sqrt(dx * dx + dy * dy);
                  // 近づいた結果、コミュニケーションが開始できる位置関係になったなら開始する
                  if (this.width < dlen && dlen < this.width * 4 && (Math.abs(dx) < this.width * 0.5 || Math.abs(dy) < this.height * 0.5)) {
                     this.motionId = 'communicate-tsudumi';
                     this.angle = 0;
                     // 本当は動かないようにしたいが、向き自体を移動ベクトルを元に判定しているので、とても小さい値でお茶を濁す
                     this.updateVector(dx / dlen * 0.0001, dy / dlen * 0.0001);
                     this.tsudumi.motionId = 'communicate-sasara';
                     this.tsudumi.angle = 0;
                     this.tsudumi.updateVector(-this.vx, -this.vy);
                     break;
                  } else if (dlen < 50) { // 近くまで来れたので満足
                     this.motionId = 'tsudumi-homing-end';
                     this.accel = 0.99;
                     this.angle *= 0.6;
                     break;
                  }
                  if ((dx * this.vx + dy * this.vy) / (dlen * this.vlen) < 0) {
                     this.angle = 3;
                  } else {
                     this.angle = 3 * (this.vx * dy - this.vy * dx) / dlen;
                  }
               }
               break;
            case 'tsudumi-homing-end': // 追尾モードで近くまで寄ったあと、減速してゆっくり歩く
               if (this.vlen < 0.5) {
                  this.motionId = 'default';
                  this.accel = 1;
               }
               break;
            case 'turn':
               if (frames === 120) {
                  this.angle = 0;
                  this.motionId = 'default';
               }
               break;
            case 'communicate-tsudumi':
               if (Math.random() > 0.98) {
                  // コミュニケーション終了、ふたりはそれぞれの道を歩み出す
                  this.tsudumi.motionId = 'communicate-sasara-end';
                  this.tsudumi.updateVector(this.vx * 2500, this.vy * 2500);
                  this.tsudumi.accel = 1.01;
                  this.motionId = 'communicate-tsudumi-end';
                  this.updateVector(-this.vx * 2500, -this.vy * 2500);
                  this.accel = 1.01;
                  break;
               }
               // 次に取るコミュニケーションのリアクションを決定する。足踏み多め、回転少なめ
               this.motionId = 'communicate-'
                  + (Math.random() > 0.9 ? 'rotate' : 'step') + '-'
                  + ['sasara', 'tsudumi', 'both'][Math.random() * 3 | 0];
               break;
            case 'communicate-rotate-sasara':
            case 'communicate-rotate-tsudumi':
            case 'communicate-rotate-both':
            case 'communicate-step-sasara':
            case 'communicate-step-tsudumi':
            case 'communicate-step-both':
               const isBoth = this.motionId.substring(this.motionId.length - 5) === '-both';
               const isSasara = isBoth || this.motionId.substring(this.motionId.length - 7) === '-sasara';
               const isTsudumi = isBoth || this.motionId.substring(this.motionId.length - 8) === '-tsudumi';
               switch (this.motionId.substring(12, 13)) {
                  case 'r': // rotate
                     if (isSasara) {
                        this.angle = frames & 1 ? 45 : 0;
                     }
                     if (isTsudumi) {
                        this.tsudumi.angle = frames & 1 ? 45 : 0;
                     }
                     if (frames === 16) {
                        this.motionId = 'communicate-tsudumi';
                     }
                     break;
                  case 's': // step
                     if ((frames & 3) === 0) {
                        if (isSasara) {
                           this.incrementAnimeFrame();
                        }
                        if (isTsudumi) {
                           this.tsudumi.incrementAnimeFrame();
                        }
                     }
                     if (frames === 16) {
                        this.motionId = 'communicate-tsudumi';
                     }
                     break;
               }
               break;
            case 'communicate-tsudumi-end':
               if (this.vlen > 0.5) {
                  this.accel = 1;
               }
               if (frames > 600 && this.accel === 1) {
                  this.motionId = 'default';
               }
               break;
         }
      }
   }

   class Tsudumi extends Walker {
      protected processMotion(frames: number): void {
         switch (this.motionId) {
            case 'default':
               this.accel = this.vlen > 0.6 ? 0.99 : this.vlen < 0.5 ? 1.01 : 1;
               if ((frames & 0xf) === 0 && Math.random() > 0.98) {
                  this.motionId = 'turn';
                  this.angle = Math.random() > 0.5 ? 0.75 : -0.75;
               }
               break;
            case 'turn':
               if (frames === 120) {
                  this.angle = 0;
                  this.motionId = 'default';
               }
               break;
            case 'communicate-sasara':
               // このモーションIDが設定されている間はささら側で行動内容を決める
               break;
            case 'communicate-sasara-end':
               if (this.vlen > 0.5) {
                  this.accel = 1;
               }
               if (frames > 600 && this.accel === 1) {
                  this.motionId = 'default';
               }
               break;
         }
      }
   }

   class Tak extends Walker {
      protected processMotion(frames: number): void {
         switch (this.motionId) {
            case 'default':
               if ((frames & 0xf) === 0 && Math.random() > 0.98) {
                  switch (Math.random() * 2 | 0) {
                     case 0:
                        this.motionId = 'turn';
                        this.angle = Math.random() > 0.5 ? 0.75 : -0.75;
                        break;
                     case 1:
                        this.motionId = 'accel';
                        this.accel = Math.random() > 0.5 ? 1.01 : 0.99;
                        break;
                  }
               }
               break;
            case 'turn':
               if (frames > 60 && Math.random() > 0.97) {
                  this.angle = 0;
                  this.motionId = 'default';
               }
               break;
            case 'accel':
               if (frames > 30 && Math.random() > 0.98) {
                  this.motionId = 'default';
                  this.accel = 1;
               }
               if (this.vlen > 1.25 || this.vlen < 0.25) {
                  this.motionId = 'default';
                  this.accel = 1;
               }
               break;
         }
      }
   }

   class Main {
      private walker: Walker[];
      public constructor(imgTag: HTMLImageElement, width: number, height: number) {
         const animeFrames = 4;
         const sasara = new Sasara(imgTag, width, height, animeFrames, width / animeFrames, 1),
            tsudumi = new Tsudumi(imgTag, width, height, animeFrames, width / animeFrames, 0),
            tak = new Tak(imgTag, width, height, animeFrames, width / animeFrames, 2);
         this.walker = [sasara, tsudumi, tak];

         sasara.tsudumi = tsudumi;

         const screenWidth = Math.min(document.documentElement.clientWidth, document.body.clientWidth);
         const screenHeight = Math.min(document.documentElement.clientHeight, document.body.clientHeight);
         for (const w of this.walker) {
            document.body.appendChild(w.elem);
            w.x = Math.random() * screenWidth;
            w.y = Math.random() * screenHeight;
            w.updateVector(Math.random() * 2 - 1, Math.random() * 2 - 1);
         }
      }

      public animate(): void {
         const screenWidth = Math.max(document.documentElement.clientWidth, document.body.clientWidth);
         const screenHeight = Math.max(document.documentElement.clientHeight, document.body.clientHeight);
         for (const w of this.walker) {
            w.process(screenWidth, screenHeight);
         }
      }
   }

   const reqAnimationFrame = (() => {
      return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(callback: FrameRequestCallback): number {
            return window.setTimeout(callback, 1000 / 60);
         };
   })();

   export function main(url: string, width: number, height: number): void {
      const imgTag = document.createElement('img');
      imgTag.crossOrigin = 'anonymous';
      imgTag.src = url;
      imgTag.onload = () => {
         if (!document.body) {
            setTimeout(imgTag.onload, 50);
            return;
         }
         const m = new Main(imgTag, width, height);
         function animate() {
            m.animate();
            reqAnimationFrame(animate);
         }
         animate();
      };
   }
}

// http://seiga.nicovideo.jp/seiga/im5646046
const imgdata16 = 'data:image/png;base64,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';
ceviwalk.main(imgdata16, 16, 16);
