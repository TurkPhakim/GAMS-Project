import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalService, ModalConfig } from '../core/modal.service';

@Component({
  selector: 'app-modal',
  template: `
    <div
      *ngIf="isVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="relative w-full max-w-xl rounded-3xl bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.45)] border border-slate-100 overflow-hidden"
      >
        <!-- content -->
        <div class="px-8 sm:px-10 pt-10 pb-8">
          <!-- ICON -->
          <div class="flex justify-center">
            <!-- success -->
            <div
              *ngIf="modalConfig?.type === 'success'"
              class="w-20 h-20 rounded-full border-[5px] border-emerald-600 flex items-center justify-center"
            >
              <svg class="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
            </div>

            <!-- error -->
            <div
              *ngIf="modalConfig?.type === 'error'"
              class="w-20 h-20 rounded-full border-[5px] border-red-500 flex items-center justify-center"
            >
              <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18"></path>
                <path d="M6 6l12 12"></path>
              </svg>
            </div>

            <!-- confirm -->
            <div
              *ngIf="modalConfig?.type === 'confirm'"
              class="w-20 h-20 rounded-full border-[5px] border-primary-700 flex items-center justify-center"
            >
              <span class="text-4xl font-black text-primary-700 leading-none">?</span>
            </div>
          </div>

          <!-- TITLE -->
          <h3 class="mt-6 text-center text-2xl sm:text-3xl font-black text-slate-900">
            {{ modalConfig?.title }}
          </h3>

          <!-- MESSAGE -->
          <p class="mt-2 text-center text-base sm:text-lg text-slate-600 leading-relaxed">
            {{ modalConfig?.message }}
          </p>

          <!-- ACTIONS -->
          <div class="mt-8">
            <!-- Success: one button -->
            <button
              *ngIf="modalConfig?.type === 'success'"
              (click)="onConfirm()"
              class="w-full h-12 sm:h-14 rounded-2xl bg-primary-700 text-white text-base sm:text-lg font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition"
            >
              {{ modalConfig?.confirmText || 'ตกลง' }}
            </button>

            <!-- Error: one button -->
            <button
              *ngIf="modalConfig?.type === 'error'"
              (click)="onConfirm()"
              class="w-full h-12 sm:h-14 rounded-2xl bg-primary-700 text-white text-base sm:text-lg font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition"
            >
              {{ modalConfig?.confirmText || 'ตกลง' }}
            </button>

            <!-- Confirm: two buttons -->
            <div *ngIf="modalConfig?.type === 'confirm'" class="grid grid-cols-2 gap-4">
              <button
                (click)="onCancel()"
                class="h-12 sm:h-14 rounded-2xl bg-slate-100 text-slate-700 text-base sm:text-lg font-bold hover:bg-slate-200 active:scale-[0.99] transition"
              >
                {{ modalConfig?.cancelText || 'ยกเลิก' }}
              </button>

              <button
                (click)="onConfirm()"
                class="h-12 sm:h-14 rounded-2xl bg-primary-700 text-white text-base sm:text-lg font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition"
              >
                {{ modalConfig?.confirmText || 'ยืนยัน' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ModalComponent implements OnInit {
  isVisible = false;
  modalConfig: ModalConfig | null = null;

  constructor(private modalService: ModalService) { }

  ngOnInit(): void {
    this.modalService.modal$.subscribe((config: ModalConfig) => {
      this.modalConfig = config;
      this.isVisible = true;
    });
  }

  onConfirm(): void {
    this.isVisible = false;
    this.modalService.confirmModal();
  }

  onCancel(): void {
    this.isVisible = false;
    this.modalService.dismissModal();
  }
}
