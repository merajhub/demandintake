import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RequestStatus } from '../../models/interfaces';

interface Step {
    label: string;
    icon: string;
    statuses: RequestStatus[];
}

@Component({
    selector: 'app-workflow-stepper',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './workflow-stepper.component.html',
    styleUrls: ['./workflow-stepper.component.css']
})
export class WorkflowStepperComponent implements OnChanges {
    @Input() status: RequestStatus = 'draft';

    steps: Step[] = [
        { label: 'Intake Form', icon: 'pi-file', statuses: ['draft', 'submitted'] },
        { label: 'Scrub Team', icon: 'pi-search', statuses: ['scrub_review', 'scrub_questions'] },
        { label: 'Committee Team', icon: 'pi-users', statuses: ['committee_review', 'committee_questions'] },
        { label: 'Approved', icon: 'pi-check-circle', statuses: ['approved', 'rejected'] },
        { label: 'Development', icon: 'pi-code', statuses: ['development'] }
    ];

    activeIndex = 0;

    ngOnChanges(): void {
        this.activeIndex = this.steps.findIndex(s => s.statuses.includes(this.status));
        if (this.activeIndex === -1) this.activeIndex = 0;
    }
}
