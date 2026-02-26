import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BreadcrumbItem {
    label: string;
    route?: string;
}

export interface BreadcrumbButton {
    label: string;
    action: () => void;
    color?: 'blue' | 'green' | 'red' | 'gray';
    style?: 'filled' | 'outline';
}

@Injectable({
    providedIn: 'root'
})
export class BreadcrumbService {
    private breadcrumbs = new BehaviorSubject<BreadcrumbItem[]>([]);
    private buttons = new BehaviorSubject<BreadcrumbButton[]>([]);

    breadcrumbs$: Observable<BreadcrumbItem[]> = this.breadcrumbs.asObservable();
    buttons$: Observable<BreadcrumbButton[]> = this.buttons.asObservable();

    setBreadcrumbs(items: BreadcrumbItem[]): void {
        this.breadcrumbs.next(items);
    }

    setButtons(buttons: BreadcrumbButton[]): void {
        this.buttons.next(buttons);
    }

    clearBreadcrumbs(): void {
        this.breadcrumbs.next([]);
    }

    clearButtons(): void {
        this.buttons.next([]);
    }

    clear(): void {
        this.breadcrumbs.next([]);
        this.buttons.next([]);
    }
}
