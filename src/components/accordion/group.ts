type Group = {
    members: Set<State>;
    required: boolean;
};

type State = { active: boolean | number };


// Brings a member's group in line with it: an open member closes the rest, and in a required group a closed member
// reopens when nothing else is open. Run when it joins and whenever it opens or closes, so several opened at once
// leave the last one to join or move open.
const settle = (group: Group, state: State) => {
    if (state.active) {
        for (let other of group.members) {
            if (other !== state) {
                other.active = false;
            }
        }

        return;
    }

    if (!group.required) {
        return;
    }

    for (let other of group.members) {
        if (other.active) {
            return;
        }
    }

    state.active = true;
};


export default ({ required = false }: { required?: boolean } = {}): Group => ({ members: new Set(), required });
export { settle };
export type { Group };
