import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { RentalCar } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

type CarForm = Omit<RentalCar, 'drivers'>;

function blankForm(): CarForm {
  return {
    company: '', confirmationNumber: '', rentalName: '', passengers: '',
    location: '', platform: '', pickupDate: '', pickupTime: '',
    pickupLocation: '', dropoffDate: '', dropoffTime: '', dropoffLocation: '',
    notes: '', link: '',
  };
}

@Component({
  selector: 'app-rental-car',
  imports: [IconComponent, CommonModule, NgTemplateOutlet, FormsModule],
  templateUrl: './rental-car.component.html',
  styleUrl: './rental-car.component.scss'
})
export class RentalCarComponent {
  dataService = inject(DataService);

  cars  = computed(() => this.dataService.data()?.rentalCar ?? []);
  users = computed(() => this.dataService.data()?.users ?? []);

  showAddForm  = signal(false);
  editingIndex = signal<number | null>(null);

  addForm  = blankForm();
  editForm = blankForm();

  startEdit(index: number): void {
    const car = this.cars()[index];
    this.editForm = {
      company:            car.company,
      confirmationNumber: car.confirmationNumber,
      rentalName:         car.rentalName  ?? '',
      passengers:         car.passengers  ?? '',
      location:           car.location    ?? '',
      platform:           car.platform    ?? '',
      pickupDate:         car.pickupDate,
      pickupTime:         car.pickupTime,
      pickupLocation:     car.pickupLocation,
      dropoffDate:        car.dropoffDate,
      dropoffTime:        car.dropoffTime,
      dropoffLocation:    car.dropoffLocation,
      notes:              car.notes,
      link:               car.link ?? '',
    };
    this.editingIndex.set(index);
  }

  saveEdit(index: number): void {
    if (!this.editForm.company.trim()) return;
    this.dataService.patchRentalCar(index, {
      company:            this.editForm.company.trim(),
      confirmationNumber: this.editForm.confirmationNumber.trim(),
      rentalName:         (this.editForm.rentalName ?? '').trim(),
      passengers:         (this.editForm.passengers ?? '').trim(),
      location:           (this.editForm.location ?? '').trim(),
      platform:           (this.editForm.platform ?? '').trim(),
      pickupDate:         this.editForm.pickupDate,
      pickupTime:         this.editForm.pickupTime,
      pickupLocation:     this.editForm.pickupLocation.trim(),
      dropoffDate:        this.editForm.dropoffDate,
      dropoffTime:        this.editForm.dropoffTime,
      dropoffLocation:    this.editForm.dropoffLocation.trim(),
      notes:              (this.editForm.notes ?? '').trim(),
      link:               (this.editForm.link ?? '').trim(),
    });
    this.editingIndex.set(null);
  }

  cancelEdit(): void {
    this.editingIndex.set(null);
  }

  deleteRentalCar(index: number): void {
    if (!confirm('Delete this rental car entry?')) return;
    this.editingIndex.set(null);
    this.dataService.deleteRentalCar(index);
  }

  addCar(): void {
    if (!this.addForm.company.trim()) return;
    this.dataService.addRentalCar({
      ...this.addForm,
      company:            this.addForm.company.trim(),
      confirmationNumber: this.addForm.confirmationNumber.trim(),
      rentalName:         (this.addForm.rentalName ?? '').trim(),
      passengers:         (this.addForm.passengers ?? '').trim(),
      location:           (this.addForm.location ?? '').trim(),
      platform:           (this.addForm.platform ?? '').trim(),
      pickupLocation:     this.addForm.pickupLocation.trim(),
      dropoffLocation:    this.addForm.dropoffLocation.trim(),
      notes:              (this.addForm.notes ?? '').trim(),
      link:               (this.addForm.link ?? '').trim(),
      drivers: '',
    });
    this.addForm = blankForm();
    this.showAddForm.set(false);
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  refresh(): void { this.dataService.refresh(); }
}
