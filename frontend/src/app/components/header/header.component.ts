import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { User } from '../../models/interfaces';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, ButtonModule, MenuModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() user: User | null = null;
  @Output() logoutClicked = new EventEmitter<void>();

  menuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.menuItems = [
      {
        label: this.user?.full_name || 'User',
        items: [
          { label: 'Dashboard', icon: 'pi pi-th-large', routerLink: '/dashboard' },
          { separator: true },
          { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.logoutClicked.emit() }
        ]
      }
    ];
  }

  ngOnChanges(): void {
    if (this.user) {
      this.menuItems = [
        {
          label: this.user.full_name + ' (' + (this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1)) + ')',
          items: [
            { label: 'Dashboard', icon: 'pi pi-th-large', routerLink: '/dashboard' },
            { separator: true },
            { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.logoutClicked.emit() }
          ]
        }
      ];
    }
  }
}
