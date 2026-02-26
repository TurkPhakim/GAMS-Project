import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ModalConfig {
    title: string;
    message: string;
    type: 'success' | 'error' | 'confirm';
    confirmText?: string;
    cancelText?: string;
}

export interface ModalResult {
    confirmed: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ModalService {
    private modalSubject = new Subject<ModalConfig>();
    private resultSubject = new Subject<ModalResult>();

    modal$ = this.modalSubject.asObservable();
    result$ = this.resultSubject.asObservable();

    dismissModal(): void {
        this.resultSubject.next({ confirmed: false });
    }

    confirmModal(): void {
        this.resultSubject.next({ confirmed: true });
    }

    showSuccess(title: string, message: string): void {
        this.modalSubject.next({
            type: 'success',
            title,
            message,
            confirmText: 'ตกลง'
        });
    }

    showError(title: string, message: string): void {
        this.modalSubject.next({
            type: 'error',
            title,
            message,
            confirmText: 'ปิด'
        });
    }

    showConfirm(title: string, message: string, confirmText = 'ตกลง', cancelText = 'ยกเลิก'): void {
        this.modalSubject.next({
            type: 'confirm',
            title,
            message,
            confirmText,
            cancelText
        });
    }
}
